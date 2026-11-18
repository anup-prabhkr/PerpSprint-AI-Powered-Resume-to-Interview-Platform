from app.models import Analysis, InterviewSession
from app.schemas.analysis import AnalysisContent
from app.schemas.interview import AnswerEvaluation, FollowUpQuestion, QuestionSet
from app.services import llm

QUESTION_SYSTEM = """You are an experienced interviewer preparing a mock interview.
Write role-specific questions grounded in the job description. When candidate skill gaps are given,
include questions that probe them fairly. Mix technical, behavioral and situational questions.
Each question must be answerable aloud in about 60-90 seconds. Do not assume any specific experience
the candidate has not listed."""

EVAL_SYSTEM = """You are a fair, specific interview coach evaluating a transcribed spoken answer.
Judge only what the transcript says; do not credit anything that was not said. Speech-to-text may contain
minor transcription errors: ignore them.
score 0-100 (relevance, depth, structure, concrete examples). feedback: 2-3 sentences.
strengths and improvements: short, concrete bullet phrases (max 3 each).
In feedback, wrap the 2 or 3 most important phrases in **double asterisks** so they can be shown in bold.
Also provide dimension scores 0-100 for: communication (clarity, structure, articulation), technical_depth (accuracy, detail, understanding), problem_solving (approach, reasoning, methodology), confidence (assertiveness, examples, conviction)."""


def generate_questions(
    role_title: str, count: int, analysis: Analysis | None
) -> QuestionSet:
    parts = [f"Role: {role_title}", f"Number of questions: {count}"]
    if analysis:
        result = AnalysisContent.model_validate(analysis.result)
        parts.append(f"JOB DESCRIPTION:\n{analysis.job_description[:6000]}")
        parts.append(f"Skills the candidate evidences: {', '.join(result.matched_skills) or 'none confirmed'}")
        parts.append(f"Skills with no evidence (probe gently): {', '.join(result.missing_skills) or 'none'}")
    qs = llm.complete_json(QuestionSet, QUESTION_SYSTEM, "\n".join(parts), temperature=0.6)
    qs.questions = qs.questions[:count]
    return qs


def evaluate_answer(session: InterviewSession, index: int, transcript: str) -> AnswerEvaluation:
    q = session.questions[index]
    user = (
        f"Role: {session.role_title}\nQuestion ({q['category']}): {q['question']}\n"
        f"Focus: {q['focus']}\n\nCandidate answer (transcript):\n{transcript[:6000]}"
    )
    return llm.complete_json(AnswerEvaluation, EVAL_SYSTEM, user)


FOLLOW_UP_SYSTEM = """You are an experienced interviewer conducting a follow-up. Based on the candidate's previous answer, generate ONE follow-up question that probes deeper into areas where the answer was weak, vague, or could benefit from more detail. The follow-up should be specific and grounded in what the candidate actually said."""


def generate_follow_up(
    session: InterviewSession, index: int, transcript: str, evaluation_score: int
) -> FollowUpQuestion:
    q = session.questions[index]
    user = (
        f"Role: {session.role_title}\n"
        f"Original question ({q['category']}): {q['question']}\n"
        f"Focus: {q['focus']}\n"
        f"Candidate answer: {transcript[:3000]}\n"
        f"Answer score: {evaluation_score}/100\n\n"
        f"Generate a follow-up question."
    )
    return llm.complete_json(FollowUpQuestion, FOLLOW_UP_SYSTEM, user, temperature=0.5)
