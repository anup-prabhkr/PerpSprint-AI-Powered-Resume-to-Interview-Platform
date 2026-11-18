import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    s = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(minutes=s.jwt_expire_minutes)
    return jwt.encode({"sub": str(user_id), "exp": exp}, s.jwt_secret, algorithm=s.jwt_algorithm)


def create_oauth_state(next_path: str, nonce: str) -> str:
    """Signed, short-lived state for the Google round trip.

    ``nonce`` is also stored in an HttpOnly cookie so the callback can prove the
    flow started in this browser (prevents login CSRF).
    """
    s = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(minutes=10)
    payload = {
        "purpose": "google_oauth",
        "next": next_path,
        "nonce": nonce,
        "exp": exp,
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_oauth_state(state: str) -> dict | None:
    s = get_settings()
    try:
        payload = jwt.decode(state, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    return payload if payload.get("purpose") == "google_oauth" else None


def decode_access_token(token: str) -> int | None:
    s = get_settings()
    try:
        payload = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
