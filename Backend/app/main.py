from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import models  # noqa: F401  (registers tables)
from app.config import get_settings
from app.database import ensure_schema
from app.errors import AppError
from app.routers import analyses, auth, interviews, mock_tests, resume_builder, reviews, roadmaps, roles


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_schema()
    yield


app = FastAPI(title="PrepSprint API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError):
    return JSONResponse({"detail": exc.message}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", []) if p not in ("body", "query", "form"))
    msg = str(first.get("msg", "Invalid request")).removeprefix("Value error, ")
    return JSONResponse({"detail": f"{field}: {msg}" if field else msg}, status_code=422)


for module in (auth, analyses, reviews, interviews, roadmaps, mock_tests, resume_builder, roles):
    app.include_router(module.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
