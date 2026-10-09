import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Wordmark } from '@/components/ui/SiteHeader';

const LINK_GROUPS = [
  {
    title: 'Get started',
    links: [
      { href: '/journeys/new', label: 'Check a journey' },
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/history', label: 'History' },
      { href: '/settings', label: 'Settings' },
    ],
  },
  {
    title: 'Learn more',
    links: [
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/#weather', label: 'Live weather' },
      { href: '/#risk-engine', label: 'How we score risk' },
      { href: '/#responsible-ai', label: 'Our approach' },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-sand-200">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Call to action */}
        <div className="flex flex-col gap-6 border-b border-ink/10 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xl font-semibold text-ink">Flying with a connection?</p>
            <p className="mt-1 text-base text-ink-soft">Check your trip in about a minute.</p>
          </div>
          <Link
            href="/journeys/new"
            className="inline-flex min-h-[48px] items-center gap-2 self-start rounded-full bg-ink px-6 text-base font-medium text-white transition-colors hover:bg-ink/85 sm:self-auto"
          >
            Check my journey
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Brand and links */}
        <div className="grid gap-10 py-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm space-y-3 sm:col-span-2 md:col-span-1">
            <Wordmark />
            <p className="text-base leading-relaxed text-ink-soft">
              Know early if your connection is at risk, and what to do about it.
            </p>
          </div>
          {LINK_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <p className="text-sm font-semibold text-ink">{group.title}</p>
              <ul className="mt-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="inline-block py-2 text-base text-ink-soft hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom line */}
        <div className="flex flex-col gap-2 border-t border-ink/10 py-6 text-sm text-ink-muted sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} SkyGuardian</span>
          <span>Always confirm changes with your airline.</span>
        </div>
      </div>
    </footer>
  );
}
