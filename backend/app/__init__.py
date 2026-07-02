import os

from flask import Flask, jsonify
from dotenv import load_dotenv

from app.config import Config
from app.extensions import db, jwt, cors

load_dotenv()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGIN"]}},
        supports_credentials=True,
    )

    from app.auth.routes import bp as auth_bp
    from app.documents.routes import bp as documents_bp
    from app.chat.routes import bp as chat_bp
    from app.admin.routes import bp as admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(admin_bp)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["CHROMA_PERSIST_DIR"], exist_ok=True)

    with app.app_context():
        db.create_all()

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", service="documind-api")

    @app.errorhandler(404)
    def not_found(_err):
        return jsonify(error="Recurso no encontrado"), 404

    @app.errorhandler(413)
    def too_large(_err):
        return jsonify(error="Archivo demasiado grande (máx. 25 MB)"), 413

    @app.errorhandler(500)
    def server_error(err):
        return jsonify(error=f"Error interno: {err}"), 500

    return app
