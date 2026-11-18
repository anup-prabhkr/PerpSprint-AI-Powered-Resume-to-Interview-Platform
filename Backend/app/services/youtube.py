"""Real YouTube links via yt-dlp's search (free, no API key)."""
from urllib.parse import quote_plus

import yt_dlp

from app.schemas.roadmap import YT_PLAYLIST_FILTER, YT_SEARCH, Link

_OPTS = {"quiet": True, "no_warnings": True, "extract_flat": True, "skip_download": True, "socket_timeout": 8}
MIN_SECONDS = 180  # skips Shorts and trailers


def _entries(url: str, limit: int) -> list[dict]:
    with yt_dlp.YoutubeDL({**_OPTS, "playlistend": limit}) as y:
        return (y.extract_info(url, download=False) or {}).get("entries") or []


def search(query: str) -> tuple[list[Link], Link | None]:
    videos: list[Link] = []
    for e in _entries(f"ytsearch8:{query}", 8):
        if e.get("id") and (e.get("duration") or MIN_SECONDS) >= MIN_SECONDS and e.get("title"):
            videos.append(Link(title=e["title"][:150], url=f"https://www.youtube.com/watch?v={e['id']}",
                               channel=(e.get("channel") or "")[:80]))
        if len(videos) == 2:
            break
    playlist = None
    for e in _entries(f"{YT_SEARCH}{quote_plus(query)}{YT_PLAYLIST_FILTER}", 3):
        url = e.get("url") or ""
        if url.startswith("https://www.youtube.com/playlist?list=") and e.get("title"):
            playlist = Link(title=e["title"][:150], url=url, channel=(e.get("channel") or "")[:80])
            break
    return videos, playlist
