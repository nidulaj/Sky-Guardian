'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, Menu, X, LogOut, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

const MARKETING_LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#agents', label: 'The agents' },
  { href: '/#weather', label: 'Airport weather' },
  { href: '/#risk-engine', label: 'Risk engine' },
  { href: '/#responsible-ai', label: 'Responsible AI' },
];

const BASE_APP_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/history', label: 'History' },
];

interface SiteHeaderProps {
  /** overlay: transparent with light text, placed over a dark hero. solid: sand background, sticky. */
  variant?: 'overlay' | 'solid';
  /** Which navigation set to show in the middle of the bar. */
  section?: 'marketing' | 'app';
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-baseline gap-1.5 ${light ? 'text-white' : 'text-ink'}`} aria-label="SkyGuardian home">
      <span className="font-sans text-[15px] font-semibold uppercase tracking-[0.28em]">SkyGuardian</span>
      <span className={`font-serif italic text-lg leading-none ${light ? 'text-coral-peach' : 'text-coral-deep'}`}>ai</span>
    </Link>
  );
}

export default function SiteHeader({ variant = 'solid', section = 'app' }: SiteHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const overlay = variant === 'overlay';

  // Include Admin Knowledge Base link if current user is an Admin
  const appLinks = isAdmin
    ? [...BASE_APP_LINKS, { href: '/admin', label: 'Admin Portal' }]
    : BASE_APP_LINKS;

  const links = section === 'app' ? appLinks : MARKETING_LINKS;

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const linkTone = overlay ? 'text-white/85 hover:text-white' : 'text-ink-soft hover:text-ink';

  return (
    <header
      className={
        overlay
          ? 'absolute inset-x-0 top-0 z-40'
          : 'sticky top-0 z-40 bg-sand-200/90 backdrop-blur-md border-b border-ink/10'
      }
    >
      <div className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Wordmark light={overlay} />

        <nav aria-label="Main" className="hidden xl:flex items-center gap-8">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-label transition-colors ${
                  active ? (overlay ? 'text-white' : 'text-ink underline underline-offset-8 decoration-coral') : linkTone
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden xl:flex items-center gap-4">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2.5">
              {/* User interactive badge */}
              <Link
                href="/profile"
                className={`group flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                  pathname === '/profile'
                    ? 'border-coral bg-coral-soft/30 text-ink'
                    : overlay
                      ? 'border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/40'
                      : 'border-ink/15 bg-sand-50 text-ink hover:border-ink/35 hover:bg-sand-100 shadow-xs'
                }`}
                title="View passenger profile"
                aria-label="Open passenger profile"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-coral to-coral-deep text-white text-[10px] font-bold shadow-xs">
                  {user.first_name ? user.first_name[0].toUpperCase() : (user.email[0]?.toUpperCase() || 'U')}
                </div>
                <span className="max-w-[130px] truncate font-medium">
                  {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email}
                </span>
                <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase font-bold tracking-wider ${
                  isAdmin
                    ? 'bg-coral-deep text-white'
                    : 'bg-sand-200 text-ink-soft'
                }`}>
                  {user.role}
                </span>
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-coral px-3 text-xs font-medium text-white transition-colors hover:bg-coral-deep"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin
                </Link>
              )}


              {/* Logout button */}
              <button
                type="button"
                onClick={handleLogout}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                  overlay
                    ? 'border-white/30 text-white hover:bg-white/10'
                    : 'border-ink/15 text-ink hover:bg-sand-100'
                }`}
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className={`inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-label ${linkTone}`}>
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-10 items-center justify-center rounded-full bg-coral px-4 text-xs font-medium text-white transition-colors hover:bg-coral-deep"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className={`xl:hidden inline-flex h-11 w-11 items-center justify-center rounded-full border ${
            overlay ? 'border-white/40 text-white' : 'border-ink/20 text-ink'
          }`}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="xl:hidden border-t border-ink/10 bg-sand-50 text-ink shadow-xl">
          <nav aria-label="Mobile" className="mx-auto flex max-w-7xl flex-col px-5 py-4">
            {isAuthenticated && user && (
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-between border-b border-ink/10 pb-4 mb-2 text-left hover:bg-sand-100/60 p-2 rounded-2xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-coral to-coral-deep text-white text-xs font-bold shadow-xs">
                    {user.first_name ? user.first_name[0].toUpperCase() : (user.email[0]?.toUpperCase() || 'U')}
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-ink block">{user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email}</span>
                    <span className="text-xs text-coral font-medium flex items-center gap-1">
                      View profile & safeguards
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
                <span className="rounded bg-coral-deep px-2 py-0.5 font-mono text-[10px] uppercase font-bold text-white">
                  {user.role}
                </span>
              </Link>
            )}

            {[...appLinks, ...MARKETING_LINKS].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? 'page' : undefined}
                className="flex items-center justify-between border-b border-ink/10 py-3.5 text-base"
              >
                {link.label}
                <ArrowRight className="h-4 w-4 text-ink-muted" aria-hidden="true" />
              </Link>
            ))}

            <div className="flex gap-3 pt-4">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-ink/20 text-sm font-medium hover:bg-sand-100"
                  >
                    <User className="h-4 w-4 text-coral" />
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-ink/20 text-sm font-medium hover:bg-sand-100"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="flex-1 inline-flex h-11 items-center justify-center rounded-full border border-ink/20 text-sm">
                    Sign in
                  </Link>
                  <Link href="/register" className="flex-1 inline-flex h-11 items-center justify-center rounded-full bg-coral text-white text-sm">
                    Register
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* End mobile menu */}
    </header>
  );
}

