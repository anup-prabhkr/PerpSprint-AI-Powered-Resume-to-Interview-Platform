import re
from pathlib import Path

import pymupdf

from app.models import Analysis
from app.schemas.review import ReviewContent
from app.services import llm

SYSTEM = """You are a sharp resume editor. Mark up the resume line by line against the job description.

Rules:
- Each highlight has a "quote": text copied EXACTLY (verbatim) from the resume, one contiguous piece within a single line, at most 150 characters.
- Do not quote names, contact details or section headings. Quotes must not overlap.
- kind "strength": 4 to 8 quotes that are concrete, measurable or clearly relevant to the job. comment says why it works. suggestion must be null.
- kind "weakness": 4 to 8 quotes that are vague, duty-only, lack outcomes, use weak verbs, or poorly match the job. comment says what is wrong.
  suggestion is a better wording of that line using ONLY facts already in the resume. If a number would help but is not in the resume,
  use a placeholder such as [X%] or [number] so the candidate fills in a real value. Never invent employers, tools, results or numbers.
  The rewrite may only mention tools, technologies and activities that already appear in the resume. Never pull terms from the job description
  into a rewrite (for example, do not add CI/CD or Kubernetes unless the resume says so). Rewrite wording and structure only.
  Do not add new responsibilities, outcomes or qualifiers. If a line is too vague to improve without new facts, give a fill-in template instead,
  such as: Built [what] using [tool from the resume], which [measurable result].
- Be specific and honest. Do not praise or criticise anything you cannot point to in the text."""


def _find(text: str, quote: str) -> tuple[int, int] | None:
    words = quote.split()
    if not words:
        return None
    match = re.search(r"\s+".join(re.escape(w) for w in words), text, re.IGNORECASE)
    return (match.start(), match.end()) if match else None


def _locate_in_pdf(doc: pymupdf.Document, snippet: str) -> list[dict]:
    """Find on-page rectangles for a piece of text (one hit per line segment)."""
    rects: list[dict] = []
    for segment in (s.strip() for s in snippet.split("\n")):
        if len(segment) < 2:
            continue
        for page in doc:
            hits = page.search_for(segment)
            if hits:
                r, size = hits[0], page.rect
                rects.append(
                    {"page": page.number + 1, "x": r.x0 / size.width, "y": r.y0 / size.height,
                     "w": r.width / size.width, "h": r.height / size.height}
                )
                break
    return rects


def generate(analysis: Analysis, pdf_path: Path | None) -> dict:
    text = analysis.resume_text
    user = (
        f"Role: {analysis.role_title}\n\nJOB DESCRIPTION:\n{analysis.job_description[:6000]}\n\n"
        f"RESUME:\n{text}"
    )
    content = llm.complete_json(ReviewContent, SYSTEM, user, temperature=0.3)

    located = []
    for h in content.highlights:
        span = _find(text, h.quote)  # quotes that are not in the resume are discarded
        if span:
            located.append((span, h))
    located.sort(key=lambda item: item[0][0])

    doc = pymupdf.open(pdf_path) if pdf_path and pdf_path.exists() else None
    highlights, last_end = [], -1
    for (start, end), h in located:
        if start < last_end:  # skip overlaps
            continue
        last_end = end
        highlights.append(
            {
                "id": f"h{len(highlights) + 1}",
                "kind": h.kind,
                "quote": text[start:end],
                "comment": h.comment,
                "suggestion": (h.suggestion or None) if h.kind == "weakness" else None,
                "start": start,
                "end": end,
                "rects": _locate_in_pdf(doc, text[start:end]) if doc else [],
            }
        )
    page_count = doc.page_count if doc else 0
    if doc:
        doc.close()
    return {"mode": "pdf" if page_count else "text", "page_count": page_count, "highlights": highlights}
