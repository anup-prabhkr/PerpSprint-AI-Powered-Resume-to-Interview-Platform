'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth';

function GoogleCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const { signInWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const failure = params.get('error');
    if (failure) {
      setError(failure);
      return;
    }

    const token = params.get('token');
    if (!token) {
      setError('Google sign-in did not return a session. Please try again.');
      return;
    }

    const raw = params.get('next') ?? '/';
    const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

    signInWithToken(token)
      .then(() => router.replace(next))
      .catch(() => setError('We could not finish signing you in. Please try again.'));
  }, [params, router, signInWithToken]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900 px-4">
      <div className="w-full max-w-md animate-fade-up rounded-3xl bg-white p-8 text-center shadow-2xl sm:p-10">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500">
            <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl tracking-tight">PrepSprint</span>
        </div>

        {error ? (
          <>
            <h1 className="font-display text-2xl">Sign-in failed</h1>
            <p role="alert" className="mt-2 text-sm font-medium text-rose-600">
              {error}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl">Finishing sign-in</h1>
            <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Talking to Google
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-navy-900">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      }
    >
      <GoogleCallback />
    </Suspense>
  );
}
