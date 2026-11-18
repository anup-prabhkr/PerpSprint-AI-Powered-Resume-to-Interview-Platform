# PrepSprint

**AI-powered interview preparation platform.** Upload your resume, paste a job description, and get a scored gap analysis, a highlighted resume review, a mock interview with feedback, an MCQ test on your weak spots, and a 7-day study plan with real learning links — plus a resume builder that exports a PDF.

Built as a full-stack college project: **FastAPI + SQLAlchemy + Groq** on the backend, **Next.js 13 (App Router) + Tailwind** on the frontend.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Google sign-in](#google-sign-in)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Tests](#tests)
- [Deployment](#deployment)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)

---

## Features

| Feature | What it does |
|---|---|
| **Resume analysis** | Upload a PDF/DOCX + job description → overall score, match %, 5-part breakdown (technical skills, experience relevance, keyword coverage, project relevance, readability), requirement-by-requirement verdicts with resume evidence, prioritised suggestions, matched/missing skills. |
| **Resume review** | Sentence-level highlights drawn onto the actual PDF (proxied page images) or inline for DOCX: strengths plus rewrites for weak bullets. Cached per analysis, re-generate on demand. |
| **Mock interview** | Generates role-specific questions from an analysis or a job title. Answer by **recording** (Groq Whisper transcription) or by **typing**. Each answer gets a 0–100 score, four dimension scores (communication, technical depth, problem solving, confidence), strengths and fixes. |
| **Adaptive follow-ups** | For any answer scoring under 70, ask one probing follow-up question targeting the weakest area. |
| **Mock test** | Multiple-choice quiz generated from your analysis, scored on submit, with per-question explanations and aggregated weak topics. |
| **7-day roadmap** | Day-by-day plan (focus, hours, tasks) aimed at the gaps found in the analysis. Every resource is a **real link** — YouTube videos, GeeksforGeeks articles, LeetCode problems — never an invented URL. Day progress is stored server-side. |
| **Resume builder** | Parse an existing resume into structured sections (personal info, summary, skills, experience, projects, education, certifications), edit it in the browser, save/update/delete drafts, and export a PDF in a `professional` or `minimal` template. |
| **Role templates** | Ready-made role/skill templates that pre-fill the job title and description when starting an analysis. |
| **Auth** | Email + password (bcrypt, JWT bearer tokens) and optional **Google sign-in** (OAuth 2.0 with cookie-bound state). All data is scoped to the signed-in user. |

### Screens

| Route | Purpose |
|---|---|
| `/` | Dashboard: scores, trend chart, recent analyses |
| `/new` | New analysis (resume upload + JD, role templates) |
| `/analysis/[id]` | Score breakdown, requirements, suggestions, matched/missing skills |
| `/analysis/[id]/review` | Highlighted resume review |
| `/history` | All analyses |
| `/interview` | Mock interview: record or type, scores, follow-ups |
| `/roadmap` | 7-day plan with checkable tasks and resources |
| `/test` | MCQ mock test and results |
| `/resume/build` | Resume builder and PDF export |
| `/login` | Sign in / create account / Google |
| `/auth/callback` | Google OAuth landing page |

---

## Tech stack

**Backend**
- FastAPI + Uvicorn, Pydantic v2 schemas (camelCase over the wire)
- SQLAlchemy 2.0 ORM — SQLite locally, Postgres (Neon) in production
- Groq SDK: `llama-3.3-70b-versatile` for generation (`openai/gpt-oss-120b` fallback), `whisper-large-v3-turbo` for audio transcription
- PyMuPDF (PDF text + page rendering), python-docx (DOCX), fpdf2 (PDF export)
- PyJWT (app tokens + OAuth state), bcrypt (passwords), httpx (Google OAuth)
- pytest for the API test-suite (Groq mocked)

**Frontend**
- Next.js 13.5 App Router, React 18, TypeScript
- Tailwind CSS + Radix UI primitives (dialog/sheet), lucide-react icons
- Client-side auth context with a JWT in `localStorage`
- Deployable to Vercel or Netlify (`Frontend/netlify.toml`)

---

## Architecture

```
Browser (Next.js, :3000)
  │  fetch JSON + multipart, Bearer JWT
  ▼
FastAPI (/api, :8000)
  ├── routers/     auth, analyses, reviews, interviews, roadmaps,
  │                mock_tests, resume_builder, roles
  ├── services/    llm, resume_parser, analysis, review, interview,
  │                roadmap, mock_test, resume_builder, youtube, gfg,
  │                leetcode, materials
  └── SQLAlchemy ──► SQLite (dev) / PostgreSQL (prod)
                     uploads/ for stored resumes
```

Long-running AI work happens in request handlers; results are persisted so repeat views are instant. External content is fetched live and verified: YouTube search results are real video IDs, GeeksforGeeks links are checked before being returned, and LeetCode problems come from their public GraphQL API. The LLM only chooses *topics*, never URLs.

---

## Repository layout

```
Backend/
  app/
    main.py            FastAPI app, CORS, error handlers, router registration
    config.py          pydantic-settings config (.env)
    database.py        engine, session, ensure_schema() additive migrations
    models.py          User, Analysis, InterviewSession, Roadmap, MockTest, Resume, ResumeReview
    security.py        password hashing, JWT, OAuth state
    deps.py            get_current_user
    routers/           HTTP layer per feature
    services/          LLM prompts, parsing, link fetching, PDF building
    schemas/           Pydantic request/response models
  data/                roles.json (role templates), aliases.json (skill de-dupe)
  tests/test_api.py    end-to-end API tests with the LLM mocked
  Procfile, runtime.txt, requirements.txt
Frontend/
  app/                 routes (see Screens)
  components/          app shell, score ring, trend chart, review UI, ui/ primitives
  lib/                 api client, auth context, types, utils
  netlify.toml, package.json, tailwind.config.ts
PROJECT_CONTEXT.md     original requirements/spec document
```

---

## Quick start

Requirements: **Python 3.12+**, **Node 18+** (Node 20/22/24 fine), a free **Groq API key** from <https://console.groq.com>.

### Backend

```bash
cd Backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then set GROQ_API_KEY and JWT_SECRET
uvicorn app.main:app --reload --port 8000
```

- API: <http://localhost:8000> · interactive docs: <http://localhost:8000/docs> · health: `/api/health`
- Tables are created automatically on startup, and missing columns are added by `ensure_schema()`.
- Local data lives in `Backend/prepsprint.db` (SQLite) and uploaded resumes in `Backend/uploads/`.

### Frontend

```bash
cd Frontend
npm install
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                   # http://localhost:3000
```

Open <http://localhost:3000>, create an account (or use Google once configured), then **New analysis** → upload a resume → paste a job description.

### Scripts

| Where | Command | What it does |
|---|---|---|
| `Backend` | `uvicorn app.main:app --reload --port 8000` | Run the API |
| `Backend` | `python -m pytest -q` | API tests (Groq mocked) |
| `Frontend` | `npm run dev` | Dev server on :3000 |
| `Frontend` | `npm run build` | Production build |
| `Frontend` | `npm run typecheck` | `tsc --noEmit` |
| `Frontend` | `npm run lint` | ESLint |

> Don't run `npm run build` while `npm run dev` is serving the same folder — both write to `Frontend/.next` and the dev server will start throwing `__webpack_modules__[moduleId] is not a function`. Stop dev, delete `.next`, then restart.

---

## Environment variables

### `Backend/.env`

| Variable | Default | Notes |
|---|---|---|
| `GROQ_API_KEY` | – | **Required.** Generation + Whisper transcription |
| `CHAT_MODEL` | `llama-3.3-70b-versatile` | Primary model |
| `FALLBACK_CHAT_MODEL` | `openai/gpt-oss-120b` | Used when the primary is unavailable |
| `WHISPER_MODEL` | `whisper-large-v3-turbo` | Audio transcription |
| `JWT_SECRET` | `dev-only-secret-change-me` | **Change in production** (32+ random chars) |
| `JWT_ALGORITHM` | `HS256` | – |
| `JWT_EXPIRE_MINUTES` | `10080` (7 days) | Token lifetime |
| `DATABASE_URL` | `sqlite:///./prepsprint.db` | Use the Postgres URL in production |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated exact origins |
| `UPLOAD_DIR` | `uploads` | Where resume files are written |
| `MAX_RESUME_BYTES` | `5242880` | 5 MB upload cap |
| `MAX_AUDIO_BYTES` | `15728640` | 15 MB audio cap |
| `GOOGLE_CLIENT_ID` | empty | Leave empty to disable Google sign-in |
| `GOOGLE_CLIENT_SECRET` | empty | – |
| `GOOGLE_REDIRECT_URI` | `http://localhost:8000/api/auth/google/callback` | Must match Google Console exactly |
| `FRONTEND_URL` | `http://localhost:3000` | Where OAuth returns the user |

### `Frontend/.env.local`

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend origin, **no** `/api`, no trailing slash |

---

## Google sign-in

Optional. The button only appears when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.

1. Google Cloud Console → **APIs & Services → OAuth consent screen** → External → add yourself as a **Test user** (while the app is in Testing).
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. Authorized JavaScript origin: `http://localhost:3000`
   Authorized redirect URI: `http://localhost:8000/api/auth/google/callback`
4. Put the client ID/secret in `Backend/.env` and restart the backend (`.env` isn't hot-reloaded).
5. For production, add `https://<your-api>/api/auth/google/callback` to the same client and set `GOOGLE_REDIRECT_URI` + `FRONTEND_URL` accordingly.

How it works: `GET /api/auth/google/start` mints a signed, 10-minute `state` JWT containing a random nonce, stores the same nonce in an **HttpOnly, SameSite=Lax cookie**, and 307-redirects to Google. The callback refuses to issue a token unless `state.nonce` matches that cookie (`secrets.compare_digest`), which blocks login-CSRF/replay; the cookie is cleared on success. Accounts are keyed by Google's **verified** email — a Google sign-in links to an existing password account with the same address, and Google-only accounts can never be entered with a password.

---

## API reference

All endpoints are under `/api`. Except for `auth/*` and `health`, every request needs `Authorization: Bearer <token>`. Responses use camelCase.

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | `{name, email, password}` → token + user (201) |
| `POST` | `/auth/login` | `{email, password}` → token + user |
| `GET` | `/auth/me` | Current user |
| `GET` | `/auth/google/status` | `{enabled}` — whether Google is configured |
| `GET` | `/auth/google/start` | Sets state cookie, 307 → Google consent |
| `GET` | `/auth/google/callback` | Exchanges code, 307 → `{FRONTEND_URL}/auth/callback?token=…` |

### Analyses
| Method | Path | Description |
|---|---|---|
| `POST` | `/analyses` | multipart: `resume` file + `job_description`, `role_title`, `company` |
| `GET` | `/analyses` | List analyses |
| `GET` | `/analyses/{id}` | One analysis |
| `DELETE` | `/analyses/{id}` | Delete (204) |

### Reviews
| Method | Path | Description |
|---|---|---|
| `POST` | `/analyses/{id}/review` | Highlighted review; `?regenerate=true` to rebuild |
| `GET` | `/analyses/{id}/resume/pages/{page}` | PNG of a resume page (PDF mode) |

### Interviews
| Method | Path | Description |
|---|---|---|
| `POST` | `/interviews` | `{analysisId?}` or `{roleTitle}`, optional `questionCount` |
| `GET` | `/interviews` · `/interviews/{id}` | List / fetch (with average score) |
| `POST` | `/interviews/{id}/answers` | multipart `audio` **or** `transcript` (+ `question_index`) → evaluation |
| `POST` | `/interviews/{id}/follow-up` | `question_index` → one probing question |

### Roadmaps
| Method | Path | Description |
|---|---|---|
| `POST` | `/roadmaps` | `{analysisId}` → 7-day plan |
| `GET` | `/roadmaps?analysisId=` · `/roadmaps/{id}` | List / fetch |
| `PATCH` | `/roadmaps/{id}/progress` | `{done: ["1-0", …]}` → saved progress |

### Mock tests
| Method | Path | Description |
|---|---|---|
| `POST` | `/mock-tests` | `{analysisId}` → MCQ set |
| `GET` | `/mock-tests` · `/mock-tests/{id}` | List / fetch |
| `POST` | `/mock-tests/{id}/submit` | `{answers: {"0": 2, …}}` → score, per-question results, weak topics |

### Resume builder
| Method | Path | Description |
|---|---|---|
| `POST` | `/resumes/parse` | multipart `file` → structured resume |
| `POST` | `/resumes` | Save `{data}` |
| `GET` | `/resumes` · `/resumes/{id}` | List / fetch |
| `PUT` | `/resumes/{id}` | Update |
| `DELETE` | `/resumes/{id}` | Delete (204) |
| `GET` | `/resumes/{id}/export?template=professional\|minimal` | PDF download |

### Misc
| Method | Path | Description |
|---|---|---|
| `GET` | `/role-templates` | Role templates (`requiredSkills`, `niceToHave`) |
| `GET` | `/health` | `{"status":"ok"}` |

---

## Data model

```
User (id, name, email, password_hash, created_at)
 └─ Analysis (role_title, company, job_description, resume_file_name,
              resume_text, overall_score, match_percent, result JSON)
     ├─ ResumeReview (cached highlights)
     ├─ Roadmap (days JSON, progress JSON, interview_id?)
     └─ MockTest (questions JSON, result JSON?)
 └─ InterviewSession (role_title, questions JSON, answers JSON)
 └─ Resume (structured resume data JSON)
```

Everything is scoped by `user_id`: requests for another user's records return 404.

---

## Tests

```bash
cd Backend
python -m pytest -q
```

`tests/test_api.py` runs the real HTTP layer against a temporary SQLite database with the LLM, YouTube, GeeksforGeeks and Whisper calls monkeypatched. It covers auth, resume upload validation (PDF/DOCX/rejected/scanned/short JD), the full analysis → interview → roadmap flow, user isolation, review caching and highlight grounding, and LeetCode practice selection.

---

## Deployment

Free-tier path: **Neon** (Postgres) + **Render** (API) + **Vercel** (frontend).

1. **Push to GitHub.** Never commit `Backend/.env`, `.venv`, `uploads/`, `*.db`, `Frontend/.env.local`, `node_modules`, `.next`.
2. **Neon** → create a project → copy the connection string (`…?sslmode=require`).
3. **Render** → New Web Service → root directory `Backend` → build `pip install -r requirements.txt` → start from `Procfile` (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`). Set `GROQ_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGINS`, `FRONTEND_URL`, and the `GOOGLE_*` variables. Tables are created on first boot.
4. **Vercel** → import the repo → root directory `Frontend` → env `NEXT_PUBLIC_API_URL=https://<your-service>.onrender.com` → deploy.
5. **Wire them together:** set `CORS_ORIGINS` and `FRONTEND_URL` to the exact Vercel domain (no trailing slash) and redeploy Render; add the production redirect URI in Google Console.
6. **Verify:** `/api/health`, sign-up, one analysis, and a Google sign-in.

Notes: Render's free service sleeps after ~15 minutes idle (slow first request), and its filesystem is ephemeral — uploaded resumes are lost on redeploy while extracted text stays in Postgres. Use Postgres, never SQLite, in production. Netlify works too if you prefer it (`Frontend/netlify.toml` is ready).

---

## Security notes

- Passwords are bcrypt-hashed; API auth is a signed JWT (`HS256`), 7 days by default.
- Uploads are validated by extension **and** parsed content (size, real text extraction) before use.
- LLM output is grounded: quoted "evidence" and review highlights must appear in the actual resume, otherwise they are dropped.
- OAuth `state` is HMAC-signed, short-lived, nonce-bound to a browser cookie, and cleared after use.
- CORS allows only the origins in `CORS_ORIGINS`.
- Secrets belong in `.env` (local) or the platform's env/secret store (production) — never in the repo.

---

## Known limitations

- Google sign-in requires a Google Cloud OAuth client; while the consent screen is in *Testing*, only listed test users can sign in.
- One Google/password identity per email; no email verification flow for password sign-ups.
- Resume files are stored on local disk, so production needs a persistent disk or object storage to keep original PDFs.
- Analysis, review and roadmap generation are synchronous requests — slow LLM responses mean slow first loads (later views are cached).
- PDF export supports two built-in templates; no custom font/theme support yet.

---

*Spec and original requirements: [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md).*
