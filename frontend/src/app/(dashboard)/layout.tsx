'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import SiteHeader from '@/components/ui/SiteHeader';
import SiteFooter from '@/components/ui/SiteFooter';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || '/dashboard')}`);
    }
  }, [isLoading, isAuthenticated, user, router, pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:text-sand-50"
      >
        Skip to content
      </a>
      <SiteHeader variant="solid" section="app" />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-5 sm:px-8 py-10 sm:py-14 focus:outline-none">
        {isLoading ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-sand-100 border border-ink/10 shadow-sm">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-coral border-r-transparent" />
            </div>
            <div className="space-y-1">
              <p className="eyebrow text-ink-muted">Security Verification</p>
              <p className="text-sm font-medium text-ink">Verifying passenger credentials...</p>
            </div>
          </div>
        ) : !isAuthenticated || !user ? (
          <div className="relative mx-auto my-8 sm:my-14 max-w-xl overflow-hidden rounded-3xl border border-ink/15 bg-sand-50/95 p-8 sm:p-12 text-center shadow-[0_25px_60px_-15px_rgba(26,23,20,0.15)] backdrop-blur-xl">
            {/* Ambient luxury radial glow */}
            <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-status-caution/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-coral/10 blur-3xl" />

            <div className="relative space-y-6">
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-status-caution-bg border border-status-caution/30 text-status-caution shadow-inner">
                <ShieldAlert className="h-8 w-8 stroke-[2.2]" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-caution opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-status-caution" />
                </span>
              </div>

              <div className="space-y-2">
                <span className="font-mono text-[10px] tracking-widest uppercase font-bold text-status-caution">
                  Restricted Area · Authentication Required
                </span>
                <h1 className="font-sans font-semibold text-2xl sm:text-3xl text-ink leading-tight">
                  Passenger Sign-In Required
                </h1>
                <p className="text-sm text-ink-soft max-w-md mx-auto leading-relaxed">
                  You must be signed in with a registered passenger account to access real-time journey risk analysis, flight tracking, and disruption compensation engines.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link
                  href={`/login?redirect=${encodeURIComponent(pathname || '/dashboard')}`}
                  className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-sand-50 transition-colors hover:bg-ink-soft shadow-md shadow-ink/10"
                >
                  <span>Sign in as Passenger</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-ink/20 px-6 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-sand-100"
                >
                  Create Passenger Account
                </Link>
              </div>

              <div className="pt-2 border-t border-ink/10 flex items-center justify-center gap-2 text-xs font-mono text-ink-muted">
                <Lock className="h-3 w-3 text-ink-muted" />
                <span>Protected by SkyGuardian Security Clearance Protocol</span>
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
