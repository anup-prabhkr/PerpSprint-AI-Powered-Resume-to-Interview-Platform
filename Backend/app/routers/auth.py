import secrets
from urllib.parse import quote, urlencode

import httpx
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.errors import AppError
from app.models import User
from app.schemas.auth import LoginIn, RegisterIn, TokenOut, UserOut
from app.security import (
    create_access_token,
    create_oauth_state,
    decode_oauth_state,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

# Ties the OAuth round trip to the browser that started it.
OAUTH_COOKIE = "prepsprint_oauth_state"
OAUTH_COOKIE_PATH = "/api/auth"
OAUTH_STATE_MINUTES = 10

# Google-only accounts have no usable password. This is not a valid bcrypt hash,
# so verify_password() always fails for it and password login stays closed.
GOOGLE_ONLY_PASSWORD = "!google-oauth"


def _token(user: User) -> TokenOut:
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


def _safe_next(value: str | None) -> str:
    if value and value.startswith("/") and not value.startswith("//"):
        return value
    return "/"


def _google_config() -> tuple[str, str, str]:
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise AppError("Google sign-in is not configured on this server.", 503)
    return settings.google_client_id, settings.google_client_secret, settings.google_redirect_uri


def _cookie_secure() -> bool:
    # The cookie belongs to the backend origin, so follow the redirect URI scheme.
    return get_settings().google_redirect_uri.startswith("https://")


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise AppError("An account with this email already exists.", 409)
    user = User(name=body.name, email=email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    return _token(user)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise AppError("Incorrect email or password.", 401)
    return _token(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/google/status")
def google_status():
    settings = get_settings()
    return {"enabled": bool(settings.google_client_id and settings.google_client_secret)}


@router.get("/google/start")
def google_start(next: str | None = Query(default=None)):
    """Top-level navigation: sets the state cookie, then hands off to Google.

    A redirect (rather than JSON a page fetches) keeps the cookie first-party,
    so it is actually stored and sent back on the callback.
    """
    settings = get_settings()
    frontend = settings.frontend_url.rstrip("/")

    if not settings.google_client_id or not settings.google_client_secret:
        return RedirectResponse(
            f"{frontend}/auth/callback?error={quote('Google sign-in is not configured on this server.')}",
            status_code=307,
        )

    client_id, _, redirect_uri = _google_config()
    nonce = secrets.token_urlsafe(24)
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": create_oauth_state(_safe_next(next), nonce),
        "prompt": "select_account",
    }
    response = RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}", status_code=307)
    response.set_cookie(
        OAUTH_COOKIE,
        nonce,
        max_age=OAUTH_STATE_MINUTES * 60,
        httponly=True,
        samesite="lax",
        secure=_cookie_secure(),
        path=OAUTH_COOKIE_PATH,
    )
    return response


@router.get("/google/callback")
def google_callback(
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    frontend = settings.frontend_url.rstrip("/")

    def fail(message: str) -> RedirectResponse:
        # Leave the cookie alone: a forged callback must not be able to cancel a
        # legitimate sign-in that is still in progress. It expires on its own.
        return RedirectResponse(
            f"{frontend}/auth/callback?error={quote(message)}", status_code=307
        )

    if not code or not state:
        return fail("Google did not return an authorization code. Please try again.")

    payload = decode_oauth_state(state)
    cookie_nonce = request.cookies.get(OAUTH_COOKIE)
    if payload is None or not cookie_nonce:
        return fail("That sign-in link expired. Please start again.")

    # The state must have been issued to this browser: without the matching
    # cookie an attacker's code cannot be replayed into someone else's session.
    if not secrets.compare_digest(str(payload.get("nonce", "")), cookie_nonce):
        return fail("That sign-in link does not belong to this browser. Please start again.")

    client_id, client_secret, redirect_uri = _google_config()

    try:
        with httpx.Client(timeout=15) as client:
            token_res = client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if token_res.status_code != 200:
                return fail("Google rejected the sign-in. Please try again.")
            access_token = token_res.json().get("access_token")
            if not access_token:
                return fail("Google did not return an access token. Please try again.")

            info_res = client.get(
                GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
            )
            if info_res.status_code != 200:
                return fail("Could not read your Google profile. Please try again.")
            info = info_res.json()
    except httpx.HTTPError:
        return fail("Could not reach Google. Please try again.")

    email = (info.get("email") or "").strip().lower()
    if not email or info.get("email_verified") not in (True, "true", "True"):
        return fail("Your Google account has no verified email address.")

    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        name = (info.get("name") or email.split("@")[0]).strip() or email.split("@")[0]
        user = User(name=name[:80], email=email, password_hash=GOOGLE_ONLY_PASSWORD)
        db.add(user)
        db.commit()

    token = create_access_token(user.id)
    target = (
        f"{frontend}/auth/callback?token={quote(token)}"
        f"&next={quote(_safe_next(payload.get('next')))}"
    )
    response = RedirectResponse(target, status_code=307)
    response.delete_cookie(OAUTH_COOKIE, path=OAUTH_COOKIE_PATH)
    return response
