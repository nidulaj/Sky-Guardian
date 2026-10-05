'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Menu, X } from 'lucide-react';

const MARKETING_LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#agents', label: 'The agents' },
  { href: '/#risk-engine', label: 'Risk engine' },
  { href: '/#responsible-ai', label: 'Responsible AI' },
];

const APP_LINKS = [
  { href: '/journeys/new', label: 'Check a journey' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
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
  const [open, setOpen] = useState(false);
  const overlay = variant === 'overlay';
  const links = section === 'app' ? APP_LINKS : MARKETING_LINKS;

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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

        <nav aria-label="Main" className="hidden lg:flex items-center gap-8">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`font-mono text-[11px] uppercase tracking-label transition-colors ${
                  active ? (overlay ? 'text-white' : 'text-ink underline underline-offset-8 decoration-coral') : linkTone
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-6">
          <Link href="/login" className={`font-mono text-[11px] uppercase tracking-label ${linkTone}`}>
            Sign in
          </Link>
          <Link
            href="/journeys/new"
            className={`inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors ${
              overlay ? 'bg-white text-ink hover:bg-sand-100' : 'bg-ink text-sand-50 hover:bg-ink-soft'
            }`}
          >
            Check my journey
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className={`lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border ${
            overlay ? 'border-white/40 text-white' : 'border-ink/20 text-ink'
          }`}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="lg:hidden border-t border-ink/10 bg-sand-50 text-ink shadow-xl">
          <nav aria-label="Mobile" className="mx-auto flex max-w-7xl flex-col px-5 py-4">
            {[...APP_LINKS, ...MARKETING_LINKS].map((link) => (
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
              <Link href="/login" className="flex-1 inline-flex h-11 items-center justify-center rounded-full border border-ink/20 text-sm">
                Sign in
              </Link>
              <Link href="/journeys/new" className="flex-1 inline-flex h-11 items-center justify-center rounded-full bg-ink text-sand-50 text-sm">
                Check my journey
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
