import json
from typing import TypeVar

from groq import APIError, BadRequestError, Groq, NotFoundError
from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.errors import AppError

T = TypeVar("T", bound=BaseModel)

_client: Groq | None = None
_unavailable: set[str] = set()  # models Groq reported as missing for this key


def _get_client() -> Groq:
    global _client
    key = get_settings().groq_api_key
    if not key:
        raise AppError("The AI service is not configured. Set GROQ_API_KEY on the server.", 503)
    if _client is None:
        _client = Groq(api_key=key, timeout=60, max_retries=2)
    return _client


def complete_json(schema: type[T], system: str, user: str, temperature: float = 0.2) -> T:
    """Ask the model for JSON and return it validated against `schema`.

    Retries when Groq returns no JSON (an intermittent 400) or the reply fails validation.
    """
    client = _get_client()
    settings = get_settings()
    spec = json.dumps(schema.model_json_schema(by_alias=True))
    messages = [
        {"role": "system", "content": f"{system}\n\nReply with a single JSON object matching this JSON Schema:\n{spec}"},
        {"role": "user", "content": user},
    ]
    last_error = ""
    for _ in range(3):
        reply = None
        for model in (settings.chat_model, settings.fallback_chat_model):
            if model in _unavailable:
                continue
            try:
                reply = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    response_format={"type": "json_object"},
                    **({"reasoning_effort": "low"} if model.startswith("openai/gpt-oss") else {}),
                )
                break
            except NotFoundError:
                _unavailable.add(model)
            except BadRequestError as exc:
                if "json_validate_failed" not in str(exc):
                    raise AppError("The AI service rejected the request.", 502) from exc
                break  # empty generation: try the whole request again
            except APIError as exc:
                raise AppError("The AI service is unavailable right now. Please try again.", 502) from exc
        if reply is None:
            if len(_unavailable) >= 2:
                raise AppError("No configured AI model is available for this API key.", 503)
            continue

        raw = reply.choices[0].message.content or ""
        try:
            return schema.model_validate_json(raw)
        except ValidationError as exc:
            last_error = str(exc)[:800]
            messages += [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": f"That JSON failed validation:\n{last_error}\nReturn corrected JSON only."},
            ]
    raise AppError("The AI returned an unusable response. Please try again.", 502)


def transcribe(filename: str, audio: bytes) -> str:
    client = _get_client()
    try:
        result = client.audio.transcriptions.create(
            file=(filename, audio),
            model=get_settings().whisper_model,
            response_format="json",
            temperature=0.0,
        )
    except APIError as exc:
        raise AppError("Transcription failed. Please try recording again.", 502) from exc
    return (result.text or "").strip()
