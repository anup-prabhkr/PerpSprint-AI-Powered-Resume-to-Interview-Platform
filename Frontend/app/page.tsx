'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { ErrorState } from '@/components/error-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { DashboardContent } from '@/components/dashboard-content';
import { useAsyncData } from '@/hooks/use-async-data';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const { state, reload } = useAsyncData(api.listAnalyses, []);

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Your resume performance"
        description="See how your resume scores against the roles you are targeting, and what to fix next."
        actions={
          <Button asChild className="rounded-xl shadow-[0_8px_20px_-8px_rgba(31,85,230,0.6)]">
            <Link href="/new">
              <Plus className="h-4 w-4" />
              New analysis
            </Link>
          </Button>
        }
      />
      {state.status === 'loading' ? <LoadingSkeleton /> : null}
      {state.status === 'error' ? <ErrorState onRetry={reload} /> : null}
      {state.status === 'ready' && state.data.length > 0 ? <DashboardContent analyses={state.data} /> : null}
      {state.status === 'ready' && state.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center">
          <p className="font-display text-xl text-foreground">No analyses yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Upload your resume and a job description to get your first score, skill gaps and fixes.
          </p>
          <Button asChild className="mt-6 rounded-xl">
            <Link href="/new">Start your first analysis</Link>
          </Button>
        </div>
      ) : null}
    </>
  );
}
