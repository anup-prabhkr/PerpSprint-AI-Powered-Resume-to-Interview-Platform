import io
import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp()

import pymupdf
import pytest
from docx import Document
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.analysis import AnalysisContent
from app.schemas.interview import AnswerEvaluation, QuestionSet
from app.schemas.review import ReviewContent
from app.schemas.roadmap import Link, Problem, RoadmapContent
from app.services import gfg, llm, youtube

RESUME = (
    "Jane Doe\nBackend engineer. Built REST APIs with Python and FastAPI for three years.\n"
    "Deployed services with Docker on AWS and wrote PostgreSQL migrations and queries.\n"
    "Added integration tests to the checkout service."
)
JD = "We need a backend engineer with Python, FastAPI, PostgreSQL, Kubernetes and caching experience. " * 2


def fake_complete_json(schema, system, user, temperature=0.2):
    if schema is AnalysisContent:
        return AnalysisContent.model_validate(
            {
                "overallScore": 72,
                "matchPercent": 65,
                "breakdown": {
                    "technicalSkills": 70, "experienceRelevance": 70, "keywordCoverage": 60,
                    "projectRelevance": 65, "readability": 80,
                },
                "requirements": [
                    {"requirement": "Python and FastAPI", "status": "strong",
                     "evidence": "Built REST APIs with Python and FastAPI for three years."},
                    {"requirement": "Kubernetes", "status": "strong",
                     "evidence": "Ran huge Kubernetes clusters at Google scale"},  # fabricated
                    {"requirement": "Caching", "status": "missing", "evidence": "made up"},
                ],
                "suggestions": [{"priority": "critical", "title": "Show caching", "gap": "g",
                                 "why": "w", "howToImprove": "h"}],
                "takeaways": ["Solid base."],
                "matchedSkills": ["Python", "FastAPI", "Terraform"],
                "missingSkills": ["Kubernetes", "Caching"],
            }
        )
    if schema is ReviewContent:
        return ReviewContent.model_validate({"highlights": [
            {"kind": "strength", "quote": "Built REST APIs with Python and FastAPI for three years.", "comment": "Specific stack and duration."},
            {"kind": "weakness", "quote": "Added integration tests to the checkout service.", "comment": "No outcome.",
             "suggestion": "Added integration tests to the checkout service, cutting regressions by [X%]."},
            {"kind": "weakness", "quote": "Led a team of 40 engineers at Google", "comment": "made up", "suggestion": "x"},
        ]})
    if schema is QuestionSet:
        return QuestionSet.model_validate({"questions": [
            {"question": f"Question number {i} about APIs?", "category": "technical", "focus": "APIs"}
            for i in range(5)
        ]})
    if schema is AnswerEvaluation:
        return AnswerEvaluation(score=64, feedback="Decent.", strengths=["Clear"], improvements=["Add metrics"])
    if schema is RoadmapContent:
        assert "Kubernetes" in user and "Add metrics" in user
        return RoadmapContent.model_validate({"summary": "Plan.", "days": [
            {"day": d, "title": f"Day {d}", "focus": "f", "hours": 2, "tasks": ["a", "b"], "closes": "Kubernetes",
             "resources": [{"topic": "Kubernetes basics", "query": "kubernetes tutorial for beginners"}]} for d in range(1, 8)
        ]})
    raise AssertionError(schema)


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(llm, "complete_json", fake_complete_json)
    monkeypatch.setattr(youtube, "search", lambda q: (
        [Link(title="Kube", url="https://www.youtube.com/watch?v=abc", channel="Ch")], None))
    monkeypatch.setattr(gfg, "verify", lambda slugs, limit=2: [
        Link(title="K8s", url="https://www.geeksforgeeks.org/k8s/", channel="GeeksforGeeks", description="d")])
    monkeypatch.setattr(llm, "transcribe", lambda name, data: "I built an API and measured latency.")
    with TestClient(app) as c:
        yield c


def pdf_bytes(text=RESUME) -> bytes:
    doc = pymupdf.open()
    doc.new_page().insert_text((50, 72), text)
    return doc.tobytes()


def docx_bytes() -> bytes:
    buf = io.BytesIO()
    d = Document()
    for line in RESUME.splitlines():
        d.add_paragraph(line)
    d.save(buf)
    return buf.getvalue()


def auth(client, email="jane@example.com"):
    r = client.post("/api/auth/register", json={"name": "Jane", "email": email, "password": "supersecret1"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['accessToken']}"}


def test_auth_flow(client):
    headers = auth(client, "a@example.com")
    assert client.get("/api/auth/me", headers=headers).json()["email"] == "a@example.com"
    dup = client.post("/api/auth/register", json={"name": "J", "email": "A@example.com", "password": "supersecret1"})
    assert dup.status_code == 409
    assert client.post("/api/auth/login", json={"email": "a@example.com", "password": "nope"}).status_code == 401
    ok = client.post("/api/auth/login", json={"email": "a@example.com", "password": "supersecret1"})
    assert ok.status_code == 200
    assert client.get("/api/analyses").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_full_flow(client):
    h = auth(client, "flow@example.com")
    r = client.post(
        "/api/analyses", headers=h,
        data={"jobDescription": JD, "roleTitle": "Backend Engineer", "company": "Acme"} | {"job_description": JD, "role_title": "Backend Engineer"},
        files={"resume": ("cv.pdf", pdf_bytes(), "application/pdf")},
    )
    assert r.status_code == 201, r.text
    a = r.json()
    reqs = {x["requirement"]: x for x in a["requirements"]}
    assert reqs["Python and FastAPI"]["status"] == "strong"
    assert reqs["Kubernetes"]["status"] == "missing" and reqs["Kubernetes"]["evidence"] is None  # ungrounded evidence dropped
    assert a["matchedSkills"] == ["Python", "FastAPI"]  # "Terraform" not in resume -> dropped
    assert a["requirements"][0]["id"] == "r1"

    assert client.get(f"/api/analyses/{a['id']}", headers=h).json()["roleTitle"] == "Backend Engineer"
    assert len(client.get("/api/analyses", headers=h).json()) == 1

    iv = client.post("/api/interviews", headers=h, json={"analysisId": a["id"], "questionCount": 3}).json()
    assert len(iv["questions"]) == 3 and iv["averageScore"] is None
    ans = client.post(
        f"/api/interviews/{iv['id']}/answers", headers=h, data={"question_index": 0},
        files={"audio": ("a.webm", b"\x1aE\xdf\xa3fake", "audio/webm")},
    )
    assert ans.status_code == 200, ans.text
    assert ans.json()["evaluation"]["score"] == 64
    assert client.get(f"/api/interviews/{iv['id']}", headers=h).json()["averageScore"] == 64

    rm = client.post("/api/roadmaps", headers=h, json={"analysisId": a["id"]})
    assert rm.status_code == 201, rm.text
    assert rm.json()["interviewId"] == iv["id"] and len(rm.json()["days"]) == 7
    assert len(client.get(f"/api/roadmaps?analysisId={a['id']}", headers=h).json()) == 1
    res = rm.json()["days"][0]["resources"][0]
    assert res["videoUrl"] == "https://www.youtube.com/results?search_query=kubernetes+tutorial+for+beginners"
    assert res["videos"][0]["url"] == "https://www.youtube.com/watch?v=abc" and res["playlist"] is None
    assert res["articles"][0]["url"].startswith("https://www.geeksforgeeks.org/")
    assert res["playlistUrl"].endswith("&sp=EgIQAw%253D%253D")

    # Other users cannot see it.
    h2 = auth(client, "other@example.com")
    assert client.get(f"/api/analyses/{a['id']}", headers=h2).status_code == 404
    assert client.get(f"/api/interviews/{iv['id']}", headers=h2).status_code == 404

    assert client.delete(f"/api/analyses/{a['id']}", headers=h).status_code == 204


def test_docx_and_bad_uploads(client):
    h = auth(client, "up@example.com")
    form = {"job_description": JD, "role_title": "Backend Engineer"}
    ok = client.post("/api/analyses", headers=h, data=form, files={"resume": ("cv.docx", docx_bytes(), "x")})
    assert ok.status_code == 201, ok.text
    bad = client.post("/api/analyses", headers=h, data=form, files={"resume": ("cv.txt", b"hello", "text/plain")})
    assert bad.status_code == 422
    empty = client.post("/api/analyses", headers=h, data=form, files={"resume": ("cv.pdf", pdf_bytes("hi"), "x")})
    assert empty.status_code == 422 and "scanned" in empty.json()["detail"].lower()
    short = client.post("/api/analyses", headers=h, data={**form, "job_description": "short"},
                        files={"resume": ("cv.pdf", pdf_bytes(), "x")})
    assert short.status_code == 422


def test_interview_text_fallback_and_validation(client):
    h = auth(client, "iv@example.com")
    assert client.post("/api/interviews", headers=h, json={}).status_code == 422
    iv = client.post("/api/interviews", headers=h, json={"roleTitle": "Data Engineer"}).json()
    short = client.post(f"/api/interviews/{iv['id']}/answers", headers=h, data={"question_index": 0, "transcript": "hm"})
    assert short.status_code == 422
    ok = client.post(f"/api/interviews/{iv['id']}/answers", headers=h,
                     data={"question_index": 1, "transcript": "I would profile the query first."})
    assert ok.status_code == 200
    out = client.post(f"/api/interviews/{iv['id']}/answers", headers=h, data={"question_index": 99, "transcript": "x" * 20})
    assert out.status_code == 404


def test_resume_review(client):
    h = auth(client, "review@example.com")
    form = {"job_description": JD, "role_title": "Backend Engineer"}
    a = client.post("/api/analyses", headers=h, data=form, files={"resume": ("cv.pdf", pdf_bytes(), "x")}).json()
    r = client.post(f"/api/analyses/{a['id']}/review", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "pdf" and body["pageCount"] == 1
    kinds = [x["kind"] for x in body["highlights"]]
    assert sorted(kinds) == ["strength", "weakness"]  # the invented "Google" quote was dropped
    weak = next(x for x in body["highlights"] if x["kind"] == "weakness")
    assert "[X%]" in weak["suggestion"] and weak["rects"] and weak["rects"][0]["page"] == 1
    assert client.post(f"/api/analyses/{a['id']}/review", headers=h).json() == body  # cached

    page = client.get(f"/api/analyses/{a['id']}/resume/pages/1", headers=h)
    assert page.status_code == 200 and page.content[:4] == b"\x89PNG"
    assert client.get(f"/api/analyses/{a['id']}/resume/pages/2", headers=h).status_code == 404

    docx = client.post("/api/analyses", headers=h, data=form, files={"resume": ("cv.docx", docx_bytes(), "x")}).json()
    t = client.post(f"/api/analyses/{docx['id']}/review", headers=h).json()
    assert t["mode"] == "text" and "Python" in t["resumeText"]

    h2 = auth(client, "review2@example.com")
    assert client.post(f"/api/analyses/{a['id']}/review", headers=h2).status_code == 404


def test_leetcode_practice(monkeypatch):
    from app.services import leetcode

    assert leetcode.needs_dsa("Strong DSA and problem solving") and not leetcode.needs_dsa("Build REST APIs with FastAPI")

    def fake(tag, diff):
        return [Problem(title=f"{tag} {diff} {i}", url=f"https://leetcode.com/problems/{tag}-{diff}-{i}/",
                        difficulty=diff.title(), topic=tag) for i in range(3)]

    monkeypatch.setattr(leetcode, "fetch_candidates", fake)
    days = [{"day": d, "title": "t", "focus": "f", "hours": 2, "tasks": ["a", "b"],
             "dsaTopics": ["array", "bogus-tag"] if d in (1, 2) else []} for d in range(1, 8)]
    plan = RoadmapContent.model_validate({"summary": "s", "days": days})

    out = leetcode.attach(plan.model_copy(deep=True), enabled=True)
    assert out.days[0].dsa_topics == ["array"]  # unknown tags are dropped
    assert [p.difficulty for p in out.days[0].practice] == ["Easy", "Medium"]
    assert out.days[0].practice[0].url != out.days[1].practice[0].url  # no repeats across days
    assert all(not d.practice for d in out.days[2:])
    off = leetcode.attach(plan.model_copy(deep=True), enabled=False)
    assert all(not d.practice and not d.dsa_topics for d in off.days)
