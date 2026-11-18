import { CircleCheck, CircleDashed, CircleX } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RequirementStatus, SuggestionPriority } from '@/lib/types';

const STATUS_STYLES: Record<RequirementStatus, { label: string; className: string; Icon: typeof CircleCheck }> = {
  strong: {
    label: 'Strong',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    Icon: CircleCheck,
  },
  partial: {
    label: 'Partial',
    className: 'bg-amber-50 text-amber-800 ring-amber-600/25',
    Icon: CircleDashed,
  },
  missing: {
    label: 'Missing',
    className: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    Icon: CircleX,
  },
};

const PRIORITY_STYLES: Record<SuggestionPriority, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  recommended: { label: 'Recommended', className: 'bg-brand-50 text-brand-700 ring-brand-600/20' },
  optional: { label: 'Optional', className: 'bg-slate-100 text-slate-700 ring-slate-500/20' },
};

const PILL_BASE =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset';

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  const { label, className, Icon } = STATUS_STYLES[status];
  return (
    <span className={cn(PILL_BASE, className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: SuggestionPriority }) {
  const { label, className } = PRIORITY_STYLES[priority];
  return <span className={cn(PILL_BASE, className)}>{label}</span>;
}

export function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 80
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
      : score >= 65
        ? 'bg-brand-50 text-brand-700 ring-brand-600/20'
        : 'bg-amber-50 text-amber-800 ring-amber-600/25';
  return (
    <span className={cn(PILL_BASE, tone, 'font-display text-sm tabular-nums')}>
      {score}
      <span className="text-[11px] font-medium opacity-70">/ 100</span>
    </span>
  );
}
