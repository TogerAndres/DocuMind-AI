import os
from datetime import timedelta

basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(basedir, 'documind.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    CHROMA_PERSIST_DIR = os.environ.get("CHROMA_PERSIST_DIR", "./chroma_data")

    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_CHAT_MODEL = os.environ.get("GEMINI_CHAT_MODEL", "gemini-2.5-flash")
    GEMINI_EMBEDDING_MODEL = os.environ.get(
        "GEMINI_EMBEDDING_MODEL", "text-embedding-004"
    )

    CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", 800))
    CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", 150))
    MAX_CONTEXT_TOKENS = int(os.environ.get("MAX_CONTEXT_TOKENS", 6000))

    FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")

    MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB upload cap
    UPLOAD_FOLDER = os.path.join(basedir, "uploads")
