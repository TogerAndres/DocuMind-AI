import uuid
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db


def _uuid() -> str:
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="member")  # member | admin
    created_at = db.Column(db.DateTime, default=_now)

    documents = db.relationship(
        "Document", backref="owner", lazy=True, cascade="all, delete-orphan"
    )
    conversations = db.relationship(
        "Conversation", backref="user", lazy=True, cascade="all, delete-orphan"
    )

    def set_password(self, raw_password: str) -> None:
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    owner_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(20), nullable=False)  # pdf | md | txt
    status = db.Column(
        db.String(20), nullable=False, default="processing"
    )  # processing | ready | failed
    page_count = db.Column(db.Integer, default=0)
    chunk_count = db.Column(db.Integer, default=0)
    tokens_used = db.Column(db.Integer, default=0)  # embedding tokens spent ingesting
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=_now)

    chunks = db.relationship(
        "Chunk", backref="document", lazy=True, cascade="all, delete-orphan"
    )
    conversations = db.relationship(
        "Conversation", backref="document", lazy=True, cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "file_type": self.file_type,
            "status": self.status,
            "page_count": self.page_count,
            "chunk_count": self.chunk_count,
            "tokens_used": self.tokens_used,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Chunk(db.Model):
    """Metadata row mirroring each chunk stored in ChromaDB (vector lives there)."""

    __tablename__ = "chunks"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    document_id = db.Column(
        db.String(36), db.ForeignKey("documents.id"), nullable=False
    )
    chunk_index = db.Column(db.Integer, nullable=False)
    page_number = db.Column(db.Integer, nullable=True)
    char_count = db.Column(db.Integer, nullable=False)
    preview = db.Column(db.String(240), nullable=False)


class Conversation(db.Model):
    __tablename__ = "conversations"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    document_id = db.Column(
        db.String(36), db.ForeignKey("documents.id"), nullable=False
    )
    title = db.Column(db.String(255), default="Nueva conversación")
    created_at = db.Column(db.DateTime, default=_now)

    messages = db.relationship(
        "Message",
        backref="conversation",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    def to_dict(self, include_messages=False):
        data = {
            "id": self.id,
            "document_id": self.document_id,
            "title": self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_messages:
            data["messages"] = [m.to_dict() for m in self.messages]
        return data


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    conversation_id = db.Column(
        db.String(36), db.ForeignKey("conversations.id"), nullable=False
    )
    role = db.Column(db.String(20), nullable=False)  # user | assistant
    content = db.Column(db.Text, nullable=False)
    sources = db.Column(db.JSON, nullable=True)  # list of {chunk_id, page, preview}
    prompt_tokens = db.Column(db.Integer, default=0)
    completion_tokens = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=_now)

    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "sources": self.sources or [],
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
