'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Code2, FileText, Gauge, Layers, Mic, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { ScoreRing } from '@/components/score-ring';
import { BreakdownBar } from '@/components/breakdown-bar';
import { ErrorState } from '@/components/error-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { PriorityBadge, RequirementStatusBadge } from '@/components/status-badges';
import { useAsyncData } from '@/hooks/use-async-data';
import { api } from '@/lib/api';
import { formatDate, scoreVerdict } from '@/lib/format';
import type { AnalysisResult } from '@/lib/types';

const CARD = 'rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,27,51,0.04),0_12px_32px_-16px_rgba(15,27,51,0.14)]';

const BREAKDOWN = [
  { key: 'technicalSkills', label: 'Technical skills', icon: Code2 },
  { key: 'experienceRelevance', label: 'Experience relevance', icon: Gauge },
  { key: 'keywordCoverage', label: 'Keyword coverage', icon: Search },
  { key: 'projectRelevance', label: 'Project relevance', icon: Layers },
  { key: 'readability', label: 'Readability', icon: FileText },
] as const;

function Chips({ items, tone }: { items: string[]; tone: 'good' | 'bad' }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">None</p>;
  const cls = tone === 'good' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{item}</span>
      ))}
    </div>
  );
}

function Report({ a }: { a: AnalysisResult }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className={CARD}>
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <ScoreRing score={a.overallScore} />
            <p className="font-display text-xl">{scoreVerdict(a.overallScore)}</p>
            <p className="text-sm text-muted-foreground">{a.matchPercent}% job match</p>
          </CardContent>
        </Card>
        <Card className={`${CARD} lg:col-span-2`}>
          <CardHeader><CardTitle className="font-display text-xl">Score breakdown</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {BREAKDOWN.map(({ key, label, icon }) => (
              <BreakdownBar key={key} label={label} value={a.breakdown[key]} icon={icon} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className={CARD}>
        <CardHeader><CardTitle className="font-display text-xl">Key takeaways</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            {a.takeaways.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </CardContent>
      </Card>

      <Card id="skills" className={`${CARD} scroll-mt-24`}>
        <CardHeader>
          <CardTitle className="font-display text-xl">Skill gap analysis</CardTitle>
          <CardDescription>Each requirement from the job description, checked against your resume.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2"><p className="text-sm font-semibold">Matched skills</p><Chips items={a.matchedSkills} tone="good" /></div>
            <div className="flex flex-col gap-2"><p className="text-sm font-semibold">Missing skills</p><Chips items={a.missingSkills} tone="bad" /></div>
          </div>
          <div className="divide-y divide-border">
            {a.requirements.map((r) => (
              <div key={r.id} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <p className="font-medium">{r.requirement}</p>
                  <p className="text-sm text-muted-foreground">{r.evidence ? `“${r.evidence}”` : 'No evidence found in your resume.'}</p>
                </div>
                <RequirementStatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className={CARD}>
        <CardHeader><CardTitle className="font-display text-xl">Improvement suggestions</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {a.suggestions.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 rounded-xl border border-border p-4">
              <PriorityBadge priority={s.priority} />
              <p className="font-medium">{s.title}</p>
              <p className="text-sm text-muted-foreground"><strong className="text-foreground">Gap:</strong> {s.gap}</p>
              <p className="text-sm text-muted-foreground"><strong className="text-foreground">Why it matters:</strong> {s.why}</p>
              <p className="text-sm text-muted-foreground"><strong className="text-foreground">How to improve:</strong> {s.howToImprove}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AnalysisPage() {
  const id = Number(useParams<{ id: string }>().id);
  const { state, reload } = useAsyncData(() => api.getAnalysis(id), [id]);

  if (state.status === 'loading') return <LoadingSkeleton />;
  if (state.status === 'error') return <ErrorState message="This analysis could not be loaded." onRetry={reload} />;

  const a = state.data;
  return (
    <>
      <PageHeader
        backHref="/history"
        backLabel="All analyses"
        eyebrow={a.company ?? 'Analysis'}
        title={a.roleTitle}
        description={`${a.resumeFileName} · ${formatDate(a.createdAt)}`}
        actions={
          <>
            <Button asChild variant="outline" className="rounded-xl"><Link href={`/analysis/${a.id}/review`}><FileText className="h-4 w-4" />Line-by-line review</Link></Button>
            <Button asChild variant="outline" className="rounded-xl"><Link href={`/interview?analysis=${a.id}`}><Mic className="h-4 w-4" />Practice interview</Link></Button>
            <Button asChild className="rounded-xl"><Link href={`/roadmap?analysis=${a.id}`}>7-day roadmap</Link></Button>
          </>
        }
      />
      <Report a={a} />
    </>
  );
}
