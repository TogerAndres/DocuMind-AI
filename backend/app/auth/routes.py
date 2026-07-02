from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from app.extensions import db
from app.models import User

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.post("/register")
def register():
    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip()
    password = data.get("password") or ""

    if not email or not name or len(password) < 8:
        return jsonify(
            error="email, name y password (min. 8 caracteres) son requeridos"
        ), 400

    if User.query.filter_by(email=email).first():
        return jsonify(error="Ya existe una cuenta con ese email"), 409

    # First user in the system becomes admin automatically.
    is_first_user = User.query.count() == 0
    user = User(email=email, name=name, role="admin" if is_first_user else "member")
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=user.id)
    return jsonify(user=user.to_dict(), access_token=token), 201


@bp.post("/login")
def login():
    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify(error="Credenciales inválidas"), 401

    token = create_access_token(identity=user.id)
    return jsonify(user=user.to_dict(), access_token=token)


@bp.get("/me")
@jwt_required()
def me():
    user = User.query.get_or_404(get_jwt_identity())
    return jsonify(user=user.to_dict())
