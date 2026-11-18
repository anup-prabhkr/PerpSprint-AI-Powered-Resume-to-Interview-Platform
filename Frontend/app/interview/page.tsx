'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, Check, Loader2, MessageSquarePlus, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, Input, Textarea, inputClass } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import { ScorePill } from '@/components/status-badges';
import { ScoreRing } from '@/components/score-ring';
import { RichText } from '@/components/rich-text';
import { api } from '@/lib/api';
import type { AnalysisResult, Answer, DimensionScores, FollowUpQuestion, Interview } from '@/lib/types';

const DIMENSIONS = [
  { key: 'communication', label: 'Communication' },
  { key: 'technicalDepth', label: 'Technical depth' },
  { key: 'problemSolving', label: 'Problem solving' },
  { key: 'confidence', label: 'Confidence' },
] as const;

type Phase = 'idle' | 'recording' | 'processing';

function answerVerdict(score: number) {
  if (score >= 80) return 'Excellent answer';
  if (score >= 65) return 'Good answer';
  return 'Room to grow';
}

function FeedbackList({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'improve' }) {
  if (items.length === 0) return null;
  const good = tone === 'good';
  const Icon = good ? Check : ArrowUpRight;
  return (
    <div className={`rounded-2xl p-5 ${good ? 'bg-emerald-50' : 'bg-amber-50'}`}>
      <p className={`text-sm font-bold uppercase tracking-wider ${good ? 'text-emerald-700' : 'text-amber-800'}`}>{title}</p>
      <ul className="mt-3 flex flex-col gap-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-base font-medium leading-snug text-slate-800">
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${good ? 'bg-emerald-200' : 'bg-amber-200'}`}>
              <Icon className={`h-3.5 w-3.5 ${good ? 'text-emerald-800' : 'text-amber-900'}`} strokeWidth={3} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DimensionBars({ dimensions }: { dimensions: DimensionScores }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DIMENSIONS.map(({ key, label }) => (
        <div key={key}>
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>{label}</span>
            <span className="tabular-nums">{dimensions[key]}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${dimensions[key]}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Setup({ onStart }: { onStart: (interview: Interview) => void }) {
  const preselected = useSearchParams().get('analysis') ?? '';
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [analysisId, setAnalysisId] = useState(preselected);
  const [roleTitle, setRoleTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listAnalyses().then(setAnalyses).catch(() => undefined);
  }, []);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onStart(await api.createInterview(analysisId ? { analysisId: Number(analysisId) } : { roleTitle }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the interview.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={start} className="flex max-w-xl flex-col gap-4">
      <Field label="Base questions on one of your analyses">
        <select className={inputClass} value={analysisId} onChange={(e) => setAnalysisId(e.target.value)}>
          <option value="">None, I will enter a role</option>
          {analyses.map((a) => (
            <option key={a.id} value={a.id}>{a.roleTitle}{a.company ? ` · ${a.company}` : ''}</option>
          ))}
        </select>
      </Field>
      {!analysisId ? (
        <Field label="Role title">
          <Input required value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Data Engineer" />
        </Field>
      ) : null}
      {error ? <p role="alert" className="text-sm font-medium text-rose-600">{error}</p> : null}
      <Button type="submit" disabled={busy} className="w-fit rounded-xl">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Preparing questions</> : 'Start interview'}
      </Button>
    </form>
  );
}

function Arena({ interview }: { interview: Interview }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<'record' | 'type'>('record');
  const [typed, setTyped] = useState('');
  const [followUps, setFollowUps] = useState<Record<number, FollowUpQuestion>>({});
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const total = interview.questions.length;
  const done = index >= total;
  const answer = answers[index];

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setPhase('processing');
        try {
          const result = await api.submitAnswer(interview.id, index, new Blob(chunks.current, { type: rec.mimeType }));
          setAnswers((prev) => ({ ...prev, [index]: result }));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not process your answer.');
        }
        setPhase('idle');
      };
      rec.start();
      recorder.current = rec;
      setPhase('recording');
    } catch {
      setError('Microphone access is needed to record your answer.');
    }
  }

  async function submitTyped() {
    const text = typed.trim();
    if (text.length < 10) {
      setError('Write a little more — at least a full sentence.');
      return;
    }
    setError(null);
    setPhase('processing');
    try {
      const result = await api.submitTypedAnswer(interview.id, index, text);
      setAnswers((prev) => ({ ...prev, [index]: result }));
      setTyped('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not score your answer.');
    }
    setPhase('idle');
  }

  async function requestFollowUp() {
    setFollowUpBusy(true);
    setError(null);
    try {
      const res = await api.getFollowUp(interview.id, index);
      setFollowUps((prev) => ({ ...prev, [index]: res.followUp }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a follow-up.');
    }
    setFollowUpBusy(false);
  }

  if (done) {
    const scores = Object.values(answers).map((a) => a.evaluation.score);
    const avg = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;
    return (
      <Card className="max-w-xl rounded-2xl">
        <CardContent className="flex flex-col items-start gap-4 p-6">
          <h2 className="font-display text-2xl">Interview complete</h2>
          {avg !== null ? <ScorePill score={avg} /> : <p className="text-sm text-muted-foreground">No answers were recorded.</p>}
          <div className="flex gap-3">
            {interview.analysisId ? (
              <Button asChild className="rounded-xl"><Link href={`/roadmap?analysis=${interview.analysisId}`}>Build my 7-day roadmap</Link></Button>
            ) : null}
            <Button asChild variant="outline" className="rounded-xl"><Link href="/">Back to dashboard</Link></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const q = interview.questions[index];
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
        Question {index + 1} of {total} · {q.category}
      </p>
      <h2 className="font-display text-3xl leading-snug sm:text-4xl">{q.question}</h2>

      {followUps[index] ? (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
            Follow-up · {followUps[index].focus}
          </p>
          <p className="mt-2 text-lg font-medium text-foreground">{followUps[index].question}</p>
        </div>
      ) : null}

      {!answer ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5">
          <div className="flex gap-2">
            {(
              [
                { value: 'record', label: 'Record answer', icon: Mic },
                { value: 'type', label: 'Type answer', icon: MessageSquarePlus },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  mode === value ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          {mode === 'record' ? (
            <div className="flex items-center gap-4">
              {phase === 'recording' ? (
                <Button size="lg" onClick={() => recorder.current?.stop()} className="rounded-xl bg-rose-600 text-base hover:bg-rose-700">
                  <Square className="h-4 w-4" />Stop and submit
                </Button>
              ) : (
                <Button size="lg" onClick={startRecording} disabled={phase === 'processing'} className="rounded-xl text-base">
                  {phase === 'processing' ? <><Loader2 className="h-4 w-4 animate-spin" />Transcribing and scoring</> : <><Mic className="h-4 w-4" />Record answer</>}
                </Button>
              )}
              {phase === 'recording' ? <span className="flex items-center gap-2 text-sm text-rose-600"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" />Recording</span> : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Textarea
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                maxLength={6000}
                placeholder="Type your answer as you would say it out loud."
                className="min-h-[150px]"
              />
              <Button onClick={submitTyped} disabled={phase === 'processing'} className="w-fit rounded-xl">
                {phase === 'processing' ? <><Loader2 className="h-4 w-4 animate-spin" />Scoring</> : 'Submit answer'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex animate-fade-up flex-col gap-6 rounded-3xl border border-border bg-white p-6 shadow-[0_12px_40px_-16px_rgba(15,27,51,0.2)] sm:p-8">
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <ScoreRing score={answer.evaluation.score} size={128} strokeWidth={9} />
            <div className="text-center sm:text-left">
              <p className="font-display text-3xl text-foreground">{answerVerdict(answer.evaluation.score)}</p>
              <p className="mt-2 text-lg leading-relaxed text-slate-600">
                <RichText text={answer.evaluation.feedback} />
              </p>
            </div>
          </div>
          {answer.evaluation.dimensions ? (
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">Score breakdown</p>
              <DimensionBars dimensions={answer.evaluation.dimensions} />
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <FeedbackList title="What worked" items={answer.evaluation.strengths} tone="good" />
            <FeedbackList title="Level up" items={answer.evaluation.improvements} tone="improve" />
          </div>
          <details className="group rounded-2xl bg-slate-50 p-5">
            <summary className="cursor-pointer text-base font-semibold text-foreground">What you said</summary>
            <p className="mt-3 text-base leading-relaxed text-slate-600">{answer.transcript}</p>
          </details>
          {answer.evaluation.score < 70 && !followUps[index] ? (
            <Button variant="outline" onClick={requestFollowUp} disabled={followUpBusy} className="w-fit rounded-xl">
              {followUpBusy ? <><Loader2 className="h-4 w-4 animate-spin" />Writing a follow-up</> : <><MessageSquarePlus className="h-4 w-4" />Request follow-up question</>}
            </Button>
          ) : null}
          <Button size="lg" onClick={() => setIndex(index + 1)} className="w-fit rounded-xl text-base">
            {index + 1 === total ? 'Finish interview' : 'Next question'}
          </Button>
        </div>
      )}
      {error ? <p role="alert" className="text-sm font-medium text-rose-600">{error}</p> : null}
      {!answer ? <button onClick={() => setIndex(index + 1)} className="w-fit text-base text-muted-foreground hover:text-foreground">Skip question</button> : null}
    </div>
  );
}

export default function InterviewPage() {
  const [interview, setInterview] = useState<Interview | null>(null);
  return (
    <>
      <PageHeader eyebrow="Interview arena" title="Practice out loud" description="Answer role-specific questions by voice and get instant feedback." />
      {interview ? <Arena interview={interview} /> : <Suspense><Setup onStart={setInterview} /></Suspense>}
    </>
  );
}
