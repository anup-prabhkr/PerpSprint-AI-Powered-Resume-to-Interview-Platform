"""Attaches real YouTube and GeeksforGeeks material to each roadmap topic. Failures just mean no links."""
import logging
import re
from concurrent.futures import ThreadPoolExecutor

from app.schemas.roadmap import Resource, RoadmapContent
from app.services import gfg, youtube

log = logging.getLogger(__name__)


_FILLER = {"fundamentals", "basics", "basic", "intro", "introduction", "setup", "interview", "tutorial", "guide",
           "for", "beginners", "beginner", "and", "the", "to", "in", "with", "of", "a", "an", "crash", "course", "prep"}


def _candidates(resource: Resource) -> list[str]:
    """Model-proposed slugs first, then predictable GeeksforGeeks names built from the topic."""
    words = [w for w in re.findall(r"[a-z0-9]+", f"{resource.topic} {resource.query}".lower()) if w not in _FILLER]
    derived = []
    for n in (2, 1):
        if len(words) >= n:
            derived += ["-".join(words[:n]) + "-tutorial", "introduction-to-" + "-".join(words[:n])]
    return list(dict.fromkeys(resource.gfg_slugs + derived))


def _lookup(resource: Resource):
    videos, playlist, articles = [], None, []
    try:
        videos, playlist = youtube.search(resource.query)
    except Exception:
        log.warning("YouTube lookup failed for %r", resource.query, exc_info=True)
    try:
        articles = gfg.verify(_candidates(resource), limit=2)
    except Exception:
        log.warning("GFG lookup failed for %r", resource.query, exc_info=True)
    return videos, playlist, articles


def attach(content: RoadmapContent) -> RoadmapContent:
    """Overwrites anything the model wrote with links that really came from the sources."""
    resources = [r for d in content.days for r in d.resources]
    with ThreadPoolExecutor(max_workers=6) as pool:
        found = list(pool.map(_lookup, resources))
    for r, (videos, playlist, articles) in zip(resources, found):
        r.videos, r.playlist, r.articles = videos, playlist, articles
    return content
