'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Map, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import { ScoreRing } from '@/components/score-ring';
import { api } from '@/lib/api';
import type { AnalysisResult, MockTest } from '@/lib/types';

const LETTERS = ['A', 'B', 'C', 'D'];

const DIFFICULTY_STYLE: Record<string, string> = {
  easy: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-800',
  hard: 'bg-rose-50 text-rose-700',
};

function Results({ test, onRetake }: { test: MockTest; onRetake: () => void }) {
  const result = test.result;
  if (!result) return null;

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-2xl border-border/70">
        <CardContent className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ScoreRing score={result.percentage} size={128} strokeWidth={9} />
            <div className="text-center sm:text-left">
              <p className="font-display text-2xl">
                {result.score} of {result.total} correct
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.percentage >= 80
                  ? 'Strong baseline. Sharpen the weak topics below.'
                  : result.percentage >= 60
                    ? 'Solid start. Your weak topics point to what to revise first.'
                    : 'Plenty of room to grow — start with the weak topics below.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/roadmap?analysis=${test.analysisId}`}>
                <Map className="h-4 w-4" />Go to roadmap
              </Link>
            </Button>
            <Button onClick={onRetake} className="rounded-xl">
              <RotateCcw className="h-4 w-4" />Retake test
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70">
        <CardContent className="flex flex-col gap-4 p-6">
          <div>
            <p className="font-display text-xl">Weak topics</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Topics where you got fewer than half the questions right.
            </p>
          </div>
          {result.weakTopics.length === 0 ? (
            <p className="text-sm font-medium text-emerald-700">No weak topics — every topic scored above 50%.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {result.weakTopics.map((topic) => (
                <li key={topic.topic} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
                  <span className="font-medium">{topic.topic}</span>
                  <span className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{topic.correct}/{topic.total} correct</span>
                    <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">Review</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <p className="font-display text-xl">Question breakdown</p>
        {result.results.map((r) => {
          const question = test.questions[r.questionIndex];
          if (!question) return null;
          return (
            <Card key={r.questionIndex} className="rounded-2xl border-border/70">
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="font-medium">
                    <span className="mr-2 text-muted-foreground">{r.questionIndex + 1}.</span>
                    {question.question}
                  </p>
                  <span className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${DIFFICULTY_STYLE[question.difficulty]}`}>
                      {question.difficulty}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        r.isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {r.isCorrect ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {r.isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </span>
                </div>
                <div className="grid gap-2 text-sm">
                  <p className={r.isCorrect ? 'text-emerald-700' : 'text-rose-700'}>
                    <strong className="font-semibold">Your answer: </strong>
                    {r.selected >= 0 ? question.options[r.selected]?.text : 'Not answered'}
                  </p>
                  {!r.isCorrect ? (
                    <p className="text-emerald-700">
                      <strong className="font-semibold">Correct answer: </strong>
                      {question.options[r.correct]?.text}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground">
                    <strong className="font-semibold text-foreground">Why: </strong>
                    {question.explanation}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{question.topic}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function MockTestPage() {
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [analysisId, setAnalysisId] = useState('');
  const [test, setTest] = useState<MockTest | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listAnalyses()
      .then((list) => {
        setAnalyses(list);
        if (list[0]) setAnalysisId(String(list[0].id));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your analyses.'));
  }, []);

  async function generate() {
    if (!analysisId) return;
    setBusy(true);
    setError(null);
    setAnswers({});
    try {
      setTest(await api.createMockTest(Number(analysisId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the test.');
    }
    setBusy(false);
  }

  async function submit() {
    if (!test) return;
    setBusy(true);
    setError(null);
    try {
      setTest(await api.submitMockTest(test.id, answers));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the test.');
    }
    setBusy(false);
  }

  const answered = Object.keys(answers).length;
  const total = test?.questions.length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Mock test"
        title="Test the gaps, not just the buzzwords"
        description="Generate a 10–15 question quiz from one of your analyses, then see exactly which topics to revise."
      />

      {error ? (
        <p role="alert" className="mb-4 text-sm font-medium text-rose-600">
          {error}
        </p>
      ) : null}

      {analyses.length === 0 && !error ? (
        <p className="text-muted-foreground">
          Run a resume analysis first, then come back to generate a mock test.{' '}
          <Link href="/new" className="font-semibold text-brand-600 hover:underline">
            New analysis
          </Link>
        </p>
      ) : null}

      {analyses.length > 0 && !test ? (
        <div className="flex max-w-xl flex-col gap-4">
          <Field label="Base the test on one of your analyses">
            <select className={inputClass} value={analysisId} onChange={(e) => setAnalysisId(e.target.value)}>
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.roleTitle}
                  {a.company ? ` · ${a.company}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Button onClick={generate} disabled={busy || !analysisId} className="w-fit rounded-xl">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating questions
              </>
            ) : (
              'Generate mock test'
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            Questions are weighted towards the skills your resume did not evidence, so the test finds real gaps.
          </p>
        </div>
      ) : null}

      {test && test.result ? <Results test={test} onRetake={generate} /> : null}

      {test && !test.result ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-white p-5">
            <div>
              <p className="font-display text-lg">{test.roleTitle}</p>
              <p className="text-sm text-muted-foreground">
                Answered {answered} / {total}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-40 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${total ? (answered / total) * 100 : 0}%` }}
                />
              </div>
              <Button onClick={submit} disabled={busy || answered < total} className="rounded-xl">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit test
              </Button>
            </div>
          </div>

          <ol className="flex flex-col gap-4">
            {test.questions.map((q, index) => (
              <li key={index}>
                <Card className="rounded-2xl border-border/70">
                  <CardContent className="flex flex-col gap-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="max-w-2xl font-medium">
                        <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                        {q.question}
                      </p>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{q.topic}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${DIFFICULTY_STYLE[q.difficulty]}`}>
                          {q.difficulty}
                        </span>
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {q.options.map((option, optionIndex) => {
                        const selected = answers[String(index)] === optionIndex;
                        return (
                          <button
                            key={optionIndex}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setAnswers((prev) => ({ ...prev, [String(index)]: optionIndex }))}
                            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                              selected
                                ? 'border-brand-500 bg-brand-50 font-medium'
                                : 'border-border bg-white hover:border-brand-300 hover:bg-slate-50'
                            }`}
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                selected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {LETTERS[optionIndex]}
                            </span>
                            <span>{option.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              Answered {answered} / {total}
            </span>
            <Button onClick={submit} disabled={busy || answered < total} className="rounded-xl">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit test
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
