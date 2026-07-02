import os
import uuid

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models import Document, Chunk
from app.documents.ingestion import extract_pages, chunk_pages
from app.chat import rag

bp = Blueprint("documents", __name__, url_prefix="/api/documents")

ALLOWED_EXTENSIONS = {"pdf": "pdf", "md": "md", "markdown": "md", "txt": "txt"}


def _process_document(document: Document, file_path: str) -> None:
    """Runs the full ingestion pipeline synchronously. Kept as its own
    function so it can be reused by both upload and the admin 're-process'
    action."""
    try:
        cfg = current_app.config
        pages = extract_pages(file_path, document.file_type)
        chunks = chunk_pages(pages, cfg["CHUNK_SIZE"], cfg["CHUNK_OVERLAP"])

        if not chunks:
            document.status = "failed"
            document.error_message = "No se pudo extraer texto del documento."
            db.session.commit()
            return

        # Clear any previous chunk rows / vectors (used on re-process).
        Chunk.query.filter_by(document_id=document.id).delete()
        rag.delete_collection(document.id)

        chunk_records = []
        chunk_rows = []
        for c in chunks:
            chunk_id = str(uuid.uuid4())
            chunk_records.append(
                {
                    "id": chunk_id,
                    "text": c.text,
                    "page_number": c.page_number,
                    "chunk_index": c.chunk_index,
                }
            )
            chunk_rows.append(
                Chunk(
                    id=chunk_id,
                    document_id=document.id,
                    chunk_index=c.chunk_index,
                    page_number=c.page_number,
                    char_count=len(c.text),
                    preview=c.text[:240],
                )
            )

        tokens_used = rag.index_chunks(document.id, chunk_records)

        db.session.add_all(chunk_rows)
        document.page_count = len({p.page_number for p in pages if p.page_number} or [0])
        document.chunk_count = len(chunk_records)
        document.tokens_used = tokens_used
        document.status = "ready"
        document.error_message = None
        db.session.commit()
    except Exception as exc:  # noqa: BLE001 - surface any ingestion failure to the UI
        document.status = "failed"
        document.error_message = str(exc)
        db.session.commit()


@bp.post("")
@jwt_required()
def upload_document():
    user_id = get_jwt_identity()

    if "file" not in request.files:
        return jsonify(error="No se envió ningún archivo"), 400

    file = request.files["file"]
    filename = secure_filename(file.filename or "")
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        return jsonify(error="Formato no soportado. Usa PDF, Markdown o TXT."), 400

    upload_dir = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_dir, exist_ok=True)

    document = Document(
        owner_id=user_id, filename=filename, file_type=ALLOWED_EXTENSIONS[ext]
    )
    db.session.add(document)
    db.session.commit()

    stored_path = os.path.join(upload_dir, f"{document.id}_{filename}")
    file.save(stored_path)

    _process_document(document, stored_path)

    return jsonify(document=document.to_dict()), 201


@bp.get("")
@jwt_required()
def list_documents():
    user_id = get_jwt_identity()
    docs = (
        Document.query.filter_by(owner_id=user_id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return jsonify(documents=[d.to_dict() for d in docs])


@bp.get("/<document_id>")
@jwt_required()
def get_document(document_id):
    user_id = get_jwt_identity()
    doc = Document.query.filter_by(id=document_id, owner_id=user_id).first_or_404()
    return jsonify(document=doc.to_dict())


@bp.delete("/<document_id>")
@jwt_required()
def delete_document(document_id):
    user_id = get_jwt_identity()
    doc = Document.query.filter_by(id=document_id, owner_id=user_id).first_or_404()

    rag.delete_collection(doc.id)
    db.session.delete(doc)  # cascades to chunks + conversations
    db.session.commit()
    return jsonify(success=True)


@bp.post("/<document_id>/reprocess")
@jwt_required()
def reprocess_document(document_id):
    user_id = get_jwt_identity()
    doc = Document.query.filter_by(id=document_id, owner_id=user_id).first_or_404()

    upload_dir = current_app.config["UPLOAD_FOLDER"]
    stored_path = os.path.join(upload_dir, f"{doc.id}_{doc.filename}")
    if not os.path.exists(stored_path):
        return jsonify(error="Archivo original no encontrado en el servidor"), 404

    doc.status = "processing"
    db.session.commit()
    _process_document(doc, stored_path)

    return jsonify(document=doc.to_dict())
