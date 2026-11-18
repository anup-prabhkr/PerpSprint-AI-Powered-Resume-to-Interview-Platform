from collections import defaultdict

from app.schemas.mock_test import (
    MCQuestion,
    MockTestContent,
    MockTestResult,
    QuestionResult,
    WeakTopic,
)
from app.services import llm

SYSTEM = """\
You are a technical quiz generator for job interview preparation.
Generate a set of multiple-choice questions (MCQs) to test a candidate's knowledge.

Rules:
- Generate between 10 and 15 questions.
- Each question must have exactly 4 options with exactly 1 correct answer.
- Include a mix of difficulties: roughly 30% easy, 50% medium, and 20% hard.
- Each question must have a "topic" tag (e.g. "React Hooks", "SQL Joins", "Docker Networking").
- Each question must have an "explanation" that explains why the correct answer is right.
- Cover both the matched skills (the candidate knows) and missing skills (gaps to test).
- For matched skills: test deeper/advanced concepts to validate real understanding.
- For missing skills: test foundational concepts to gauge baseline awareness.
- Questions should be practical and scenario-based where possible, not trivia.
- Do NOT repeat the same topic more than twice.
- Use camelCase for all JSON keys.\
"""


def generate(matched_skills: list[str], missing_skills: list[str], role_title: str) -> MockTestContent:
    """Generate MCQs based on the candidate's skill profile."""
    user_msg = (
        f"Role: {role_title}\n"
        f"Matched skills (candidate has): {', '.join(matched_skills) if matched_skills else 'none listed'}\n"
        f"Missing skills (candidate lacks): {', '.join(missing_skills) if missing_skills else 'none listed'}\n\n"
        "Generate 10-15 multiple-choice questions testing these skills. "
        "Focus more questions on the missing skills to help identify weak areas, "
        "but include some on matched skills to verify depth of knowledge."
    )
    return llm.complete_json(MockTestContent, SYSTEM, user_msg)


def score(questions: list[MCQuestion], answers: dict[str, int]) -> MockTestResult:
    """Score the submitted answers and identify weak topics."""
    results: list[QuestionResult] = []
    topic_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"correct": 0, "total": 0})

    for idx, q in enumerate(questions):
        selected = answers.get(str(idx), -1)
        is_correct = selected == q.correct_index

        results.append(
            QuestionResult(
                question_index=idx,
                selected=selected,
                correct=q.correct_index,
                is_correct=is_correct,
                topic=q.topic,
            )
        )

        topic_stats[q.topic]["total"] += 1
        if is_correct:
            topic_stats[q.topic]["correct"] += 1

    total = len(questions)
    correct_count = sum(1 for r in results if r.is_correct)
    percentage = round((correct_count / total) * 100) if total else 0

    # Weak topics: scored below 50% (or 0 correct)
    weak_topics = [
        WeakTopic(topic=topic, correct=stats["correct"], total=stats["total"])
        for topic, stats in sorted(topic_stats.items())
        if stats["total"] > 0 and (stats["correct"] / stats["total"]) < 0.5
    ]

    return MockTestResult(
        score=correct_count,
        total=total,
        percentage=percentage,
        results=results,
        weak_topics=weak_topics,
    )
