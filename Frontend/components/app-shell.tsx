'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClipboardCheck, FileText, History, LayoutDashboard, Loader2, LogOut, Map, Menu, Mic, Plus, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/new', label: 'New analysis', icon: Plus },
  { href: '/resume/build', label: 'Resume builder', icon: FileText },
  { href: '/test', label: 'Mock test', icon: ClipboardCheck },
  { href: '/history', label: 'History', icon: History },
  { href: '/interview', label: 'Interview arena', icon: Mic },
  { href: '/roadmap', label: 'Roadmap', icon: Map },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/' || pathname.startsWith('/analysis');
  return pathname.startsWith(href);
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 shadow-[0_8px_24px_-8px_rgba(45,107,255,0.8)]">
        <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
      </span>
      <span className="font-display text-lg tracking-tight text-white">PrepSprint</span>
    </Link>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
              active
                ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                : 'text-slate-300 hover:bg-white/5 hover:text-white',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 transition-colors',
                active ? 'text-brand-100' : 'text-slate-400 group-hover:text-white',
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  const { user, signOut } = useAuth();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{user?.name}</p>
        <p className="truncate text-xs text-slate-300">{user?.email}</p>
      </div>
      <button
        type="button"
        onClick={signOut}
        aria-label="Sign out"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const isLoginPage = pathname === '/login';
  const isAuthPage = isLoginPage || pathname === '/auth/callback';

  useEffect(() => {
    if (!loading && !user && !isAuthPage) router.replace('/login');
    if (!loading && user && isLoginPage) router.replace('/');
  }, [loading, user, isAuthPage, isLoginPage, router]);

  if (isAuthPage && !user) return <>{children}</>;
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between bg-navy-900 px-5 py-6 lg:flex">
        <div className="flex flex-col gap-10">
          <Brand />
          <div className="flex flex-col gap-3">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Workspace
            </p>
            <NavLinks pathname={pathname} />
          </div>
        </div>
        <SidebarFooter />
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-navy-900 px-4 lg:hidden">
        <Brand />
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open navigation"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col justify-between border-navy-700 bg-navy-900 p-6">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex flex-col gap-10">
              <Brand />
              <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            </div>
            <SidebarFooter />
          </SheetContent>
        </Sheet>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
