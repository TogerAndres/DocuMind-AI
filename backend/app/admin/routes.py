from functools import wraps

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models import User, Document, Conversation, Message

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = User.query.get(get_jwt_identity())
        if not user or user.role != "admin":
            return jsonify(error="Se requiere rol de administrador"), 403
        return fn(*args, **kwargs)

    return wrapper


@bp.get("/metrics")
@admin_required
def metrics():
    total_docs = Document.query.count()
    ready_docs = Document.query.filter_by(status="ready").count()
    failed_docs = Document.query.filter_by(status="failed").count()
    total_users = User.query.count()
    total_conversations = Conversation.query.count()
    total_messages = Message.query.count()

    embedding_tokens = sum(d.tokens_used or 0 for d in Document.query.all())
    chat_tokens = sum(
        (m.prompt_tokens or 0) + (m.completion_tokens or 0)
        for m in Message.query.all()
    )

    return jsonify(
        {
            "documents": {
                "total": total_docs,
                "ready": ready_docs,
                "failed": failed_docs,
                "processing": total_docs - ready_docs - failed_docs,
            },
            "users": total_users,
            "conversations": total_conversations,
            "messages": total_messages,
            "tokens": {
                "embedding_tokens": embedding_tokens,
                "chat_tokens": chat_tokens,
                "total": embedding_tokens + chat_tokens,
            },
        }
    )


@bp.get("/documents")
@admin_required
def all_documents():
    docs = Document.query.order_by(Document.created_at.desc()).all()
    result = []
    for d in docs:
        payload = d.to_dict()
        payload["owner_email"] = d.owner.email
        result.append(payload)
    return jsonify(documents=result)
