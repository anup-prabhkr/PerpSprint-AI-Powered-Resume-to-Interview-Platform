from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    groq_api_key: str = ""
    chat_model: str = "llama-3.3-70b-versatile"
    fallback_chat_model: str = "openai/gpt-oss-120b"
    whisper_model: str = "whisper-large-v3-turbo"

    jwt_secret: str = "dev-only-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    # Google OAuth: leave the id/secret empty to disable Google sign-in.
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"
    frontend_url: str = "http://localhost:3000"

    database_url: str = "sqlite:///./prepsprint.db"
    cors_origins: str = "http://localhost:3000"

    upload_dir: str = "uploads"
    max_resume_bytes: int = 5 * 1024 * 1024
    max_audio_bytes: int = 15 * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        # The app is often opened at 127.0.0.1:3000 instead of localhost:3000.
        # Both spellings of loopback are accepted so that a local session does
        # not fail with a misleading "cannot reach the server" error.
        for origin in list(origins):
            if "//localhost" in origin:
                origins.append(origin.replace("//localhost", "//127.0.0.1"))
            elif "//127.0.0.1" in origin:
                origins.append(origin.replace("//127.0.0.1", "//localhost"))
        return list(dict.fromkeys(origins))


@lru_cache
def get_settings() -> Settings:
    return Settings()
