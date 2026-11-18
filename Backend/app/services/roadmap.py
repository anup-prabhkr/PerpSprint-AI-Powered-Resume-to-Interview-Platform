from app.models import Analysis, InterviewSession
from app.schemas.analysis import AnalysisContent
from app.schemas.roadmap import RoadmapContent
from app.services import leetcode, llm, materials

SYSTEM_TEMPLATE = """You are a career coach building a SHORT, easy 7-day preparation plan for one candidate and one target role.
Base it strictly on the gaps and interview feedback provided. Never invent experience for the candidate.
Order days so the biggest gaps come first. Mix learning with practice. Day 7 is a full mock interview and review.

Keep everything brief and in plain, simple words:
- summary: ONE sentence, max 25 words, naming the 2-3 biggest things to fix.
- title: 2-4 words. focus: one short sentence, max 12 words.
- closes: the exact gap this day fixes, taken from the gaps or interview feedback (empty on day 7).
- hours: 1 to 3.
- tasks: 2 or 3 per day, each starts with a verb and is under 12 words.
- resources: 1 or 2 per day (0 on day 7). Each is a topic (what to learn, max 6 words) and a query: the
  YouTube search text a beginner would type, such as "docker tutorial for beginners" or "system design interview basics".
  Also give gfgSlugs: 2 or 3 likely GeeksforGeeks article URL slugs for the topic, lowercase letters, digits and hyphens only,
  such as "docker-tutorial", "kubernetes-tutorial" or "system-design-tutorial". The app checks each one exists.
- dsaTopics: ONLY when the context says the role needs DSA. Put 1 or 2 LeetCode topic tags on each of 3 to 5 days
  (most important first, day 7 excluded), each chosen from: {tags}. Otherwise leave it [].
  Never write URLs, channel names or video titles; leave videos, articles and practice as [] and playlist as null. The app fills those in."""

SYSTEM = SYSTEM_TEMPLATE.replace("{tags}", ", ".join(leetcode.TAGS))


def build_context(analysis: Analysis, interview: InterviewSession | None) -> str:
    result = AnalysisContent.model_validate(analysis.result)
    gaps = [f"- {r.requirement} ({r.status})" for r in result.requirements if r.status != "strong"]
    fixes = [f"- [{s.priority}] {s.title}" for s in result.suggestions]
    lines = [
        f"Target role: {analysis.role_title}",
        "Role needs DSA / coding-interview practice: " + ("YES" if leetcode.needs_dsa(analysis.job_description) else "no"),
        "Skill gaps:\n" + ("\n".join(gaps) or "- none identified"),
        "Resume suggestions:\n" + "\n".join(fixes),
    ]
    answers = (interview.answers or {}) if interview else {}
    if answers:
        weak = []
        for idx, ans in sorted(answers.items(), key=lambda kv: int(kv[0])):
            ev = ans["evaluation"]
            q = interview.questions[int(idx)]
            weak.append(f"- {q['focus']} (score {ev['score']}): {'; '.join(ev['improvements']) or ev['feedback']}")
        lines.append("Mock interview performance:\n" + "\n".join(weak))
    else:
        lines.append("Mock interview performance: no interview taken yet.")
    return "\n\n".join(lines)


def generate(analysis: Analysis, interview: InterviewSession | None) -> RoadmapContent:
    content = llm.complete_json(RoadmapContent, SYSTEM, build_context(analysis, interview), temperature=0.4)
    content = materials.attach(content)
    return leetcode.attach(content, leetcode.needs_dsa(analysis.job_description))
