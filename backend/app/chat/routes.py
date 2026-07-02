import json

from flask import Blueprint, request, jsonify, current_app, Response
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models import Document, Conversation, Message
from app.chat import rag

bp = Blueprint("chat", __name__, url_prefix="/api")


@bp.get("/documents/<document_id>/conversations")
@jwt_required()
def list_conversations(document_id):
    user_id = get_jwt_identity()
    convos = (
        Conversation.query.filter_by(document_id=document_id, user_id=user_id)
        .order_by(Conversation.created_at.desc())
        .all()
    )
    return jsonify(conversations=[c.to_dict() for c in convos])


@bp.post("/documents/<document_id>/conversations")
@jwt_required()
def create_conversation(document_id):
    user_id = get_jwt_identity()
    doc = Document.query.filter_by(id=document_id, owner_id=user_id).first_or_404()
    if doc.status != "ready":
        return jsonify(error="El documento todavía se está procesando"), 409

    convo = Conversation(user_id=user_id, document_id=document_id)
    db.session.add(convo)
    db.session.commit()
    return jsonify(conversation=convo.to_dict()), 201


@bp.get("/conversations/<conversation_id>")
@jwt_required()
def get_conversation(conversation_id):
    user_id = get_jwt_identity()
    convo = Conversation.query.filter_by(id=conversation_id, user_id=user_id).first_or_404()
    return jsonify(conversation=convo.to_dict(include_messages=True))


@bp.post("/conversations/<conversation_id>/messages")
@jwt_required()
def post_message(conversation_id):
    """Non-streaming variant — returns the full answer + sources as JSON."""
    user_id = get_jwt_identity()
    convo = Conversation.query.filter_by(id=conversation_id, user_id=user_id).first_or_404()

    data = request.get_json(force=True) or {}
    query = (data.get("content") or "").strip()
    if not query:
        return jsonify(error="El mensaje no puede estar vacío"), 400

    answer_text, sources, prompt_tokens, completion_tokens = _run_rag_turn(
        convo, query
    )

    return jsonify(
        user_message=Message(role="user", content=query).to_dict(),
        assistant_message={
            "role": "assistant",
            "content": answer_text,
            "sources": sources,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
        },
    )


@bp.post("/conversations/<conversation_id>/messages/stream")
@jwt_required()
def stream_message(conversation_id):
    """Server-Sent Events variant used by the chat UI for token-by-token streaming."""
    user_id = get_jwt_identity()
    convo = Conversation.query.filter_by(id=conversation_id, user_id=user_id).first_or_404()

    data = request.get_json(force=True) or {}
    query = (data.get("content") or "").strip()
    if not query:
        return jsonify(error="El mensaje no puede estar vacío"), 400

    app = current_app._get_current_object()

    def event_stream():
        print("1. Entró al stream")
        with app.app_context():

            convo_db = Conversation.query.get(conversation_id)

            history = [m.to_dict() for m in convo_db.messages][-8:]
            hits = rag.retrieve(convo_db.document_id, query, top_k=6)
            print("2. Retrieve terminado")
            context_text, used_hits, context_tokens = rag.build_context(
                hits, app.config["MAX_CONTEXT_TOKENS"]
            )

            sources = [
                {
                    "chunk_id": h["chunk_id"],
                    "page_number": h["page_number"],
                    "preview": h["text"][:200],
                }
                for h in used_hits
            ]

            user_msg = Message(conversation_id=convo_db.id, role="user", content=query)
            db.session.add(user_msg)
            db.session.commit()

            yield f"event: sources\ndata: {json.dumps(sources)}\n\n"

            full_answer = ""
            try:
                print("4. Voy a llamar a Gemini")
                stream = rag.generate_answer(query, context_text, history, stream=True)
                print("5. Gemini respondió")
                for chunk in stream:
                    if chunk.text:
                            full_answer += chunk.text
                            yield f"event: token\ndata: {json.dumps(chunk.text)}\n\n"
            except Exception as exc:  # noqa: BLE001
                full_answer = (
                    "No pude generar una respuesta (revisa que GEMINI_API_KEY "
                    f"esté configurada). Detalle: {exc}"
                )
                yield f"event: token\ndata: {json.dumps(full_answer)}\n\n"

            completion_tokens = rag.count_tokens(full_answer)
            assistant_msg = Message(
                conversation_id=convo_db.id,
                role="assistant",
                content=full_answer,
                sources=sources,
                prompt_tokens=context_tokens,
                completion_tokens=completion_tokens,
            )
            db.session.add(assistant_msg)
            db.session.commit()

            yield (
                "event: done\ndata: "
                + json.dumps(
                    {
                        "prompt_tokens": context_tokens,
                        "completion_tokens": completion_tokens,
                    }
                )
                + "\n\n"
            )

    return Response(event_stream(), mimetype="text/event-stream")


def _run_rag_turn(convo: Conversation, query: str):
    cfg = current_app.config
    history = [m.to_dict() for m in convo.messages][-8:]

    hits = rag.retrieve(convo_db.document_id, query, top_k=6)
    context_text, used_hits, context_tokens = rag.build_context(
        hits, cfg["MAX_CONTEXT_TOKENS"]
    )

    sources = [
        {
            "chunk_id": h["chunk_id"],
            "page_number": h["page_number"],
            "preview": h["text"][:200],
        }
        for h in used_hits
    ]

    user_msg = Message(conversation_id=convo_db.id, role="user", content=query)
    db.session.add(user_msg)

    response = rag.generate_answer(query, context_text, history, stream=False)
    answer_text = getattr(response, "text", "") or ""
    completion_tokens = rag.count_tokens(answer_text)

    assistant_msg = Message(
        conversation_id=convo_db.id,
        role="assistant",
        content=answer_text,
        sources=sources,
        prompt_tokens=context_tokens,
        completion_tokens=completion_tokens,
    )
    db.session.add(assistant_msg)
    db.session.commit()

    return answer_text, sources, context_tokens, completion_tokens
