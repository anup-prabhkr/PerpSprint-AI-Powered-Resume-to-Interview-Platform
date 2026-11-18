import io

import pymupdf
from docx import Document

from app.errors import AppError

MIN_TEXT_CHARS = 100
MAX_TEXT_CHARS = 20_000


def extract_resume_text(filename: str, data: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf") and data[:4] == b"%PDF":
        text = _read_pdf(data)
    elif name.endswith(".docx") and data[:2] == b"PK":
        text = _read_docx(data)
    else:
        raise AppError("Please upload a valid PDF or DOCX file.", 422)

    text = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    if len(text) < MIN_TEXT_CHARS:
        raise AppError(
            "We couldn't read text from this resume. Scanned or image-only files are not supported.", 422
        )
    return text[:MAX_TEXT_CHARS]


def _read_pdf(data: bytes) -> str:
    try:
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            return "\n".join(page.get_text() for page in doc)
    except Exception as exc:
        raise AppError("This PDF could not be opened. It may be corrupted or protected.", 422) from exc


def _read_docx(data: bytes) -> str:
    try:
        doc = Document(io.BytesIO(data))
    except Exception as exc:
        raise AppError("This DOCX could not be opened. It may be corrupted.", 422) from exc
    parts = [p.text for p in doc.paragraphs]
    for table in doc.tables:
        for row in table.rows:
            parts.extend(cell.text for cell in row.cells)
    return "\n".join(parts)
