import json
import re
from pathlib import Path

from app.schemas.analysis import AnalysisContent
from app.services import llm

MAX_JD_CHARS = 12_000

# ---------------------------------------------------------------------------
# Skill alias map — loaded once at import time
# ---------------------------------------------------------------------------
_alias_p = Path(__file__).resolve().parent.parent / "data" / "aliases.json"
if not _alias_p.exists():
    _alias_p = Path(__file__).resolve().parents[2] / "data" / "aliases.json"
try:
    _ALIASES: dict[str, str] = json.loads(_alias_p.read_text(encoding="utf-8"))
except Exception:
    _ALIASES = {}


def _canon(skill: str) -> str:
    return _ALIASES.get(skill.lower().strip(), skill.lower().strip())


_canonicalize = _canon
_SKILL_ALIASES = _ALIASES

SYSTEM = """You are a rigorous, honest resume reviewer comparing one resume to one job description.

Rules:
- Use ONLY facts in the resume text. Never invent skills, employers, dates, metrics or achievements.
- requirements: 5 to 12 key requirements taken from the job description, most important first.
- status: "strong" = clear, specific evidence; "partial" = related or shallow evidence; "missing" = no evidence.
- evidence: a short VERBATIM quote (max 200 characters) copied from the resume. Use null when status is "missing".
- matchedSkills: skills the job asks for that the resume evidences. missingSkills: skills the job asks for with no evidence.
- Scores are integers 0-100. overallScore must reflect requirement coverage, not formatting.
- suggestions: 3 to 6, ordered by priority. howToImprove must be actionable and must never tell the candidate to claim experience they do not have; for missing skills advise learning or preparing instead.
- takeaways: 2 to 4 short plain-language sentences."""

_WORD = re.compile(r"[a-z0-9+#./-]{3,}")


def _words(text: str) -> set[str]:
    return set(_WORD.findall(text.lower()))


def _grounded(snippet: str, resume_words: set[str], threshold: float) -> bool:
    words = _words(snippet)
    return bool(words) and len(words & resume_words) / len(words) >= threshold


def _dedupe(skills: list[str], resume_words: set[str] | None = None) -> list[str]:
    """Drop aliases of the same skill while keeping the casing the model used."""
    seen: dict[str, str] = {}
    for skill in skills:
        skill = skill.strip()
        if not skill or (resume_words is not None and not _grounded(skill, resume_words, 0.6)):
            continue
        seen.setdefault(_canon(skill), skill)
    return list(seen.values())


def analyze(resume_text: str, job_description: str, role_title: str, company: str | None) -> AnalysisContent:
    user = (
        f"Role: {role_title}\nCompany: {company or 'not given'}\n\n"
        f"JOB DESCRIPTION:\n{job_description[:MAX_JD_CHARS]}\n\n"
        f"RESUME:\n{resume_text}"
    )
    content = llm.complete_json(AnalysisContent, SYSTEM, user)

    resume_words = _words(resume_text)
    for req in content.requirements:
        # Evidence that is not traceable to the resume is discarded rather than trusted.
        if req.evidence and not _grounded(req.evidence, resume_words, 0.6):
            req.status, req.evidence = "missing", None
    content.matched_skills = _dedupe(content.matched_skills, resume_words)
    matched = {_canon(s) for s in content.matched_skills}
    content.missing_skills = [s for s in _dedupe(content.missing_skills) if _canon(s) not in matched]

    for i, req in enumerate(content.requirements, 1):
        req.id = f"r{i}"
    for i, sug in enumerate(content.suggestions, 1):
        sug.id = f"s{i}"
    return content
