'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, Copy, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { ErrorState } from '@/components/error-state';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ResumeHighlight, ResumeReview } from '@/lib/types';

type Filter = 'all' | 'strength' | 'weakness';

const MARK = {
  strength: 'bg-emerald-400/30 ring-emerald-500 hover:bg-emerald-400/45',
  weakness: 'bg-rose-400/30 ring-rose-500 hover:bg-rose-400/45',
} as const;

function PageImage({ analysisId, page, highlights, activeId, onSelect }: {
  analysisId: number;
  page: number;
  highlights: ResumeHighlight[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    api.getResumePage(analysisId, page).then((u) => { url = u; setSrc(u); }).catch(() => setFailed(true));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [analysisId, page]);

  if (failed) return <p className="p-6 text-sm text-rose-600">Could not load page {page}.</p>;
  if (!src) return <div className="flex aspect-[1/1.3] items-center justify-center rounded-lg bg-white"><Loader2 className="h-5 w-5 animate-spin text-brand-600" /></div>;

  return (
    <div className="relative overflow-hidden rounded-lg bg-white shadow-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`Resume page ${page}`} className="block w-full" />
      {highlights.flatMap((h) =>
        h.rects.filter((r) => r.page === page).map((r, i) => (
          <button
            key={`${h.id}-${i}`}
            id={`mark-${h.id}`}
            type="button"
            aria-label={`${h.kind === 'strength' ? 'Strength' : 'Improvement'}: ${h.quote}`}
            onClick={() => onSelect(h.id)}
            className={cn('absolute rounded-sm ring-1 transition-all', MARK[h.kind], activeId === h.id && 'z-10 ring-2')}
            style={{ left: `${r.x * 100 - 0.3}%`, top: `${r.y * 100 - 0.2}%`, width: `${r.w * 100 + 0.6}%`, height: `${r.h * 100 + 0.4}%` }}
          />
        )),
      )}
    </div>
  );
}

function TextView({ text, highlights, activeId, onSelect }: {
  text: string;
  highlights: ResumeHighlight[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const h of highlights) {
    parts.push(text.slice(cursor, h.start));
    parts.push(
      <mark
        key={h.id}
        id={`mark-${h.id}`}
        onClick={() => onSelect(h.id)}
        className={cn('cursor-pointer rounded px-0.5 ring-1', MARK[h.kind], activeId === h.id && 'ring-2')}
      >
        {text.slice(h.start, h.end)}
      </mark>,
    );
    cursor = h.end;
  }
  parts.push(text.slice(cursor));
  return <div className="whitespace-pre-wrap rounded-lg bg-white p-6 text-sm leading-relaxed shadow-md">{parts}</div>;
}

function HighlightCard({ h, active, onSelect }: { h: ResumeHighlight; active: boolean; onSelect: (id: string) => void }) {
  const [copied, setCopied] = useState(false);
  const strength = h.kind === 'strength';

  async function copy() {
    if (!h.suggestion) return;
    try {
      await navigator.clipboard.writeText(h.suggestion);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div
      id={`card-${h.id}`}
      onClick={() => onSelect(h.id)}
      className={cn(
        'cursor-pointer rounded-2xl border border-l-4 bg-white p-5 transition-shadow',
        strength ? 'border-l-emerald-500' : 'border-l-rose-500',
        active ? 'shadow-lg ring-2 ring-brand-500/40' : 'hover:shadow-md',
      )}
    >
      <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', strength ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
        {strength ? 'Strength' : 'Needs work'}
      </span>
      <p className="mt-3 border-l-2 border-slate-200 pl-3 text-sm italic text-muted-foreground">“{h.quote}”</p>
      <p className="mt-3 text-[15px] leading-relaxed">{h.comment}</p>
      {h.suggestion ? (
        <div className="mt-4 rounded-xl bg-emerald-50/70 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Suggested wording</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); copy(); }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-[15px] font-medium leading-relaxed">{h.suggestion}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {/\[[^\]]+\]/.test(h.suggestion) ? 'Replace the [brackets] with your real details. ' : ''}
            Only keep what is true for you.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function ReviewPage() {
  const id = Number(useParams<{ id: string }>().id);
  const [review, setReview] = useState<ResumeReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const started = useRef(false);

  async function load(regenerate = false) {
    setBusy(true);
    setError(null);
    try {
      setReview(await api.reviewResume(id, regenerate));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not review this resume.');
    }
    setBusy(false);
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(highlightId: string, from: 'card' | 'mark') {
    setActiveId(highlightId);
    const target = document.getElementById(`${from === 'card' ? 'mark' : 'card'}-${highlightId}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const visible = review?.highlights.filter((h) => filter === 'all' || h.kind === filter) ?? [];
  const strengths = review?.highlights.filter((h) => h.kind === 'strength').length ?? 0;
  const weaknesses = (review?.highlights.length ?? 0) - strengths;

  return (
    <>
      <PageHeader
        backHref={`/analysis/${id}`}
        backLabel="Back to report"
        eyebrow="Line-by-line review"
        title="Your resume, marked up"
        description="Green is working for you. Red is a line to rewrite, with better wording underneath."
        actions={
          <Button variant="outline" disabled={busy} onClick={() => load(true)} className="rounded-xl">
            <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} />Re-run review
          </Button>
        }
      />

      {busy && !review ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-white py-20 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
          <p className="font-medium">Reading your resume line by line…</p>
          <p className="text-sm text-muted-foreground">This takes about 10 to 20 seconds the first time.</p>
        </div>
      ) : null}
      {error ? <ErrorState message={error} onRetry={() => load()} /> : null}

      {review ? (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {([
              ['all', `All ${review.highlights.length}`],
              ['strength', `${strengths} strengths`],
              ['weakness', `${weaknesses} to improve`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ring-inset transition-colors',
                  filter === key ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-foreground ring-border hover:bg-slate-50',
                )}
              >
                {key === 'strength' ? <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> : null}
                {key === 'weakness' ? <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-rose-500" /> : null}
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-2xl bg-slate-200/70 p-3 lg:sticky lg:top-6">
              {review.mode === 'pdf'
                ? Array.from({ length: review.pageCount }, (_, i) => (
                    <PageImage
                      key={i}
                      analysisId={id}
                      page={i + 1}
                      highlights={visible}
                      activeId={activeId}
                      onSelect={(h) => select(h, 'mark')}
                    />
                  ))
                : <TextView text={review.resumeText ?? ''} highlights={visible} activeId={activeId} onSelect={(h) => select(h, 'mark')} />}
            </div>

            <div className="flex flex-col gap-4">
              {visible.length === 0 ? <p className="text-muted-foreground">Nothing to show for this filter.</p> : null}
              {visible.map((h) => (
                <HighlightCard key={h.id} h={h} active={activeId === h.id} onSelect={(x) => select(x, 'card')} />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
