import Link from 'next/link';
import { ArrowRight, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, scoreVerdict } from '@/lib/format';
import type { AnalysisResult, SuggestionPriority } from '@/lib/types';
import { ScoreRing } from '@/components/score-ring';
import { TrendChart } from '@/components/trend-chart';
import { AnalysisRow } from '@/components/analysis-row';
import { PriorityBadge } from '@/components/status-badges';

const RECENT_LIMIT = 5;
const FOCUS_LIMIT = 3;

const CARD_CLASS = 'rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,27,51,0.04),0_12px_32px_-16px_rgba(15,27,51,0.14)]';

export function DashboardContent({ analyses }: { analyses: AnalysisResult[] }) {
  const latest = analyses[0];
  const average = Math.round(
    analyses.reduce((sum, analysis) => sum + analysis.overallScore, 0) / analyses.length,
  );
  const chronological = [...analyses].reverse().map((analysis) => analysis.overallScore);
  const focus = [...latest.suggestions]
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    .slice(0, FOCUS_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className={`${CARD_CLASS} animate-fade-up`}>
          <CardContent className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-center lg:flex-col lg:items-start xl:flex-row xl:items-center">
            <ScoreRing score={latest.overallScore} size={148} strokeWidth={11} />
            <div className="flex flex-col gap-2 text-center sm:text-left lg:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Latest resume score</p>
              <p className="font-display text-xl text-foreground">{scoreVerdict(latest.overallScore)}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Average across {analyses.length} {analyses.length === 1 ? 'analysis' : 'analyses'}: {average} / 100
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className={`${CARD_CLASS} animate-fade-up [animation-delay:80ms]`}>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Latest role match</p>
              <CardTitle className="font-display text-xl">{latest.roleTitle}</CardTitle>
              <CardDescription>{latest.company ?? 'No company listed'}</CardDescription>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
              <Target className="h-5 w-5 text-brand-600" />
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <div className="flex items-end justify-between">
              <span className="text-sm text-muted-foreground">Job match</span>
              <span className="font-display text-3xl tabular-nums text-foreground">{latest.matchPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-[width] duration-1000 ease-out"
                style={{ width: `${latest.matchPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs font-medium text-muted-foreground">{formatDate(latest.createdAt)}</span>
              <Link
                href={`/analysis/${latest.id}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
              >
                View report <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className={`${CARD_CLASS} animate-fade-up [animation-delay:160ms]`}>
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Score trend</p>
            <CardDescription>Your overall score across each analysis</CardDescription>
          </CardHeader>
          <CardContent className="h-40 pt-2">
            <TrendChart values={chronological} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className={`${CARD_CLASS} overflow-hidden lg:col-span-2`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border pb-5">
            <div className="flex flex-col gap-1">
              <CardTitle className="font-display text-xl">Recent analyses</CardTitle>
              <CardDescription>Your latest role matches, newest first</CardDescription>
            </div>
            <Link href="/history" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <div className="divide-y divide-border">
            {analyses.slice(0, RECENT_LIMIT).map((analysis) => (
              <AnalysisRow key={analysis.id} analysis={analysis} />
            ))}
          </div>
        </Card>

        <Card className={`${CARD_CLASS} lg:col-span-1`}>
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-xl">Focus next</CardTitle>
            <CardDescription>The top fixes for {latest.roleTitle}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {focus.map((suggestion) => (
              <Link
                key={suggestion.id}
                href={`/analysis/${latest.id}`}
                className="group flex flex-col gap-2 rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-100 hover:shadow-md"
              >
                <PriorityBadge priority={suggestion.priority} />
                <span className="text-sm font-medium leading-snug text-foreground group-hover:text-brand-700">
                  {suggestion.title}
                </span>
              </Link>
            ))}
            <Link
              href={`/analysis/${latest.id}#skills`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              See full skill gap analysis <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function priorityRank(priority: SuggestionPriority) {
  return priority === 'critical' ? 0 : priority === 'recommended' ? 1 : 2;
}
