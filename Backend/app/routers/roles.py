import json
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(prefix="/role-templates", tags=["role-templates"])

ROLES_PATH = Path(__file__).resolve().parents[2] / "data" / "roles.json"


@router.get("")
def list_role_templates() -> list[dict]:
    """Curated role templates used to pre-fill the job description."""
    if not ROLES_PATH.exists():
        return []
    return json.loads(ROLES_PATH.read_text(encoding="utf-8"))
