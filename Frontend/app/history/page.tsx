'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { AnalysisRow } from '@/components/analysis-row';
import { ErrorState } from '@/components/error-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { useAsyncData } from '@/hooks/use-async-data';
import { api } from '@/lib/api';

export default function HistoryPage() {
  const { state, reload } = useAsyncData(api.listAnalyses, []);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function remove(id: number) {
    if (!window.confirm('Delete this analysis?')) return;
    try {
      await api.deleteAnalysis(id);
      reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete.');
    }
  }

  return (
    <>
      <PageHeader eyebrow="History" title="All analyses" />
      {deleteError ? <p role="alert" className="mb-4 text-sm font-medium text-rose-600">{deleteError}</p> : null}
      {state.status === 'loading' ? <LoadingSkeleton /> : null}
      {state.status === 'error' ? <ErrorState onRetry={reload} /> : null}
      {state.status === 'ready' && state.data.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing here yet. <Link href="/new" className="font-semibold text-brand-600">Run your first analysis</Link>.
        </p>
      ) : null}
      {state.status === 'ready' && state.data.length > 0 ? (
        <Card className="divide-y divide-border overflow-hidden rounded-2xl">
          {state.data.map((analysis) => (
            <AnalysisRow
              key={analysis.id}
              analysis={analysis}
              actions={
                <Button variant="ghost" size="icon" aria-label="Delete analysis" onClick={() => remove(analysis.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              }
            />
          ))}
        </Card>
      ) : null}
    </>
  );
}
