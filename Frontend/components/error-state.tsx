import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorState({
  message = 'Something went wrong while loading this page.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/60 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
        <AlertTriangle className="h-6 w-6 text-rose-600" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
