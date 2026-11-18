"""Real LeetCode problems for DSA-heavy roles, fetched by topic tag (free, no key)."""
import logging
import re
from concurrent.futures import ThreadPoolExecutor

import httpx

from app.schemas.roadmap import Problem, RoadmapContent

log = logging.getLogger(__name__)

TAGS = [
    "array", "string", "hash-table", "two-pointers", "sliding-window", "binary-search", "sorting", "stack",
    "queue", "linked-list", "tree", "binary-tree", "binary-search-tree", "heap-priority-queue", "graph",
    "breadth-first-search", "depth-first-search", "backtracking", "recursion", "dynamic-programming", "greedy",
    "math", "matrix", "prefix-sum", "bit-manipulation", "trie", "union-find", "monotonic-stack", "topological-sort",
]
_DSA = re.compile(
    r"\bdsa\b|data[- ]structures?|\balgorithms?\b|leetcode|hackerrank|competitive programming|problem[- ]solving"
    r"|coding (interview|round|challenge|test)|whiteboard",
    re.I,
)
_URL = "https://leetcode.com/graphql"
_HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
            "Referer": "https://leetcode.com/problemset/"}
_QUERY = """query($limit:Int,$filters:QuestionListFilterInput){problemsetQuestionList:questionList(
categorySlug:"",limit:$limit,skip:0,filters:$filters){questions:data{title titleSlug difficulty isPaidOnly}}}"""


def needs_dsa(job_description: str) -> bool:
    return bool(_DSA.search(job_description))


def fetch_candidates(tag: str, difficulty: str) -> list[Problem]:
    """Most frequently asked free problems for a tag. Difficulty is EASY or MEDIUM."""
    resp = httpx.post(
        _URL, headers=_HEADERS, timeout=12,
        json={"query": _QUERY, "variables": {"limit": 12, "filters": {
            "tags": [tag], "difficulty": difficulty, "orderBy": "FREQUENCY", "sortOrder": "DESCENDING"}}},
    )
    resp.raise_for_status()
    rows = resp.json()["data"]["problemsetQuestionList"]["questions"]
    return [
        Problem(title=q["title"], url=f"https://leetcode.com/problems/{q['titleSlug']}/",
                difficulty=q["difficulty"].title(), topic=tag)
        for q in rows if not q["isPaidOnly"]
    ]


def _safe(args: tuple[str, str]) -> list[Problem]:
    try:
        return fetch_candidates(*args)
    except Exception:
        log.warning("LeetCode lookup failed for %s", args, exc_info=True)
        return []


def attach(content: RoadmapContent, enabled: bool) -> RoadmapContent:
    """Fills each day's practice list; the model only chooses topics, never problems."""
    for day in content.days:
        day.dsa_topics = [t for t in dict.fromkeys(day.dsa_topics) if t in TAGS][:2] if enabled else []
        day.practice = []
    if not enabled:
        return content
    jobs = [(t, d) for day in content.days for t in day.dsa_topics for d in ("EASY", "MEDIUM")]
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = dict(zip(jobs, pool.map(_safe, jobs)))
    used: set[str] = set()
    for day in content.days:
        for tag in day.dsa_topics:
            for diff in ("EASY", "MEDIUM"):
                pick = next((p for p in results[(tag, diff)] if p.url not in used), None)
                if pick:
                    used.add(pick.url)
                    day.practice.append(pick)
    return content
