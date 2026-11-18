'use client';

import { useEffect, useState } from 'react';
import { Check, Circle, Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  'Reading the resume layout',
  'Extracting skills and experience',
  'Comparing against each requirement',
  'Scoring relevance and keyword coverage',
  'Drafting prioritized suggestions',
];

const STEP_INTERVAL_MS = 700;

export function AnalysisProgress() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((step) => Math.min(step + 1, STEPS.length - 1));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-xl animate-fade-up flex-col items-center gap-8 rounded-3xl border border-border bg-white p-8 shadow-[0_12px_40px_-16px_rgba(15,27,51,0.2)] sm:p-12">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/20" />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-600">
          <Zap className="h-7 w-7 text-white" strokeWidth={2.5} />
        </span>
      </div>

      <div className="text-center">
        <h2 className="font-display text-2xl text-foreground">Analyzing your resume</h2>
        <p className="mt-2 text-sm text-muted-foreground">This usually takes a few seconds.</p>
      </div>

      <ol className="flex w-full flex-col gap-4" aria-live="polite">
        {STEPS.map((step, index) => {
          const status = index < activeStep ? 'done' : index === activeStep ? 'active' : 'pending';
          return (
            <li
              key={step}
              className={cn(
                'flex items-center gap-3 text-sm transition-colors duration-300',
                status === 'pending' && 'text-slate-400',
                status === 'active' && 'font-medium text-brand-700',
                status === 'done' && 'text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  status === 'done' && 'bg-emerald-100',
                  status === 'active' && 'bg-brand-100',
                )}
              >
                {status === 'done' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}
                {status === 'active' ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" /> : null}
                {status === 'pending' ? <Circle className="h-3 w-3" /> : null}
              </span>
              {step}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
