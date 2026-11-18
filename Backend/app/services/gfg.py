"""GeeksforGeeks articles: the model proposes URL slugs, we keep only pages that really exist."""
import html
import re

import httpx

from app.schemas.roadmap import Link

_HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
_TITLE = re.compile(r"<title>(.*?)</title>", re.S)
_PARAGRAPH = re.compile(r"<p[^>]*>(.*?)</p>", re.S)
_TAGS = re.compile(r"<.*?>")
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{2,79}$")


def _intro(page: str) -> str:
    for raw in _PARAGRAPH.findall(page):
        text = html.unescape(_TAGS.sub("", raw)).strip()
        if len(text) >= 80 and "GeeksforGeeks" not in text[:40]:
            return text[:280]
    return ""


def fetch(slug: str) -> Link | None:
    if not SLUG.match(slug):
        return None
    resp = httpx.get(f"https://www.geeksforgeeks.org/{slug}/", headers=_HEADERS, follow_redirects=True, timeout=10)
    title = _TITLE.search(resp.text)
    if resp.status_code != 200 or resp.url.host != "www.geeksforgeeks.org" or not title:
        return None
    name = html.unescape(title.group(1)).strip()
    if not name.endswith("- GeeksforGeeks"):  # the site's 404 page has a different title
        return None
    return Link(title=name.removesuffix("- GeeksforGeeks").strip()[:150], url=str(resp.url),
                channel="GeeksforGeeks", description=_intro(resp.text))


def verify(slugs: list[str], limit: int = 2) -> list[Link]:
    out: list[Link] = []
    for slug in slugs:
        try:
            link = fetch(slug.strip().lower())
        except httpx.HTTPError:
            continue
        if link and all(link.url != o.url for o in out):
            out.append(link)
        if len(out) == limit:
            break
    return out
