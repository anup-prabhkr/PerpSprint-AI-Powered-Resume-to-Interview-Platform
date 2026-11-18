'use client';

import { useEffect, useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { api, googleSignInUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    api
      .googleStatus()
      .then((res) => setGoogleReady(res.enabled))
      .catch(() => setGoogleReady(false));
  }, []);

  function startGoogle() {
    setError(null);
    window.location.href = googleSignInUrl('/');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await signIn(form.email, form.password);
      else await signUp(form.name, form.email, form.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900 px-4">
      <div className="w-full max-w-md animate-fade-up rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500">
            <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl tracking-tight">PrepSprint</span>
        </div>
        <h1 className="font-display text-2xl">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Score your resume, practice interviews and get a 7-day plan.
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {mode === 'register' ? (
            <Field label="Name">
              <Input required value={form.name} onChange={set('name')} autoComplete="name" />
            </Field>
          ) : null}
          <Field label="Email">
            <Input required type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input
              required
              type="password"
              minLength={8}
              maxLength={72}
              value={form.password}
              onChange={set('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm font-medium text-rose-600">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy} className="rounded-xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        {googleReady ? (
          <div className="mt-6">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                or
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={startGoogle}
              disabled={busy}
              className="mt-4 w-full gap-2 rounded-xl"
            >
              <GoogleIcon />
              Continue with Google
            </Button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
          className="mt-6 w-full text-center text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {mode === 'login' ? "New here? Create an account" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.63l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
