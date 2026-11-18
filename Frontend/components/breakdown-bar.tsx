'use client';

import type { LucideIcon } from 'lucide-react';
import { useAnimatedValue } from '@/hooks/use-animated-value';

interface BreakdownBarProps {
  label: string;
  value: number;
  icon: LucideIcon;
}

export function BreakdownBar({ label, value, icon: Icon }: BreakdownBarProps) {
  const animated = useAnimatedValue(value);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-sm font-medium text-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50">
            <Icon className="h-3.5 w-3.5 text-brand-600" />
          </span>
          {label}
        </div>
        <span className="font-display text-sm tabular-nums text-foreground">{value}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-[width] duration-1000 ease-out"
          style={{ width: `${animated}%` }}
        />
      </div>
    </div>
  );
}
