import Link from 'next/link';
import { ChevronRight, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import type { AnalysisResult } from '@/lib/types';
import { ScorePill } from '@/components/status-badges';

interface AnalysisRowProps {
  analysis: AnalysisResult;
  actions?: React.ReactNode;
  className?: string;
}

export function AnalysisRow({ analysis, actions, className }: AnalysisRowProps) {
  return (
    <div
      className={cn(
        'group flex items-center gap-4 px-4 py-4 transition-colors duration-200 hover:bg-brand-50/50 sm:px-6',
        className,
      )}
    >
      <Link
        href={`/analysis/${analysis.id}`}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 transition-colors group-hover:bg-brand-100">
          <Briefcase className="h-4 w-4 text-brand-600" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2 truncate font-medium text-foreground">
            {analysis.roleTitle}
          </span>
          <span className="truncate text-sm text-muted-foreground">
            {analysis.company ?? 'No company listed'} · {formatDate(analysis.createdAt)}
          </span>
        </span>
        <span className="hidden items-center gap-4 sm:flex">
          <ScorePill score={analysis.overallScore} />
          <span className="w-24 text-right text-sm font-medium tabular-nums text-muted-foreground">
            {analysis.matchPercent}% match
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-600" />
      </Link>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
