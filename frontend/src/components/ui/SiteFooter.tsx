import React from 'react';
import Link from 'next/link';
import { Wordmark } from '@/components/ui/SiteHeader';

export default function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-sand-200">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4 max-w-sm">
          <Wordmark />
          <p className="text-sm text-ink-soft leading-relaxed">
            Decision support for travellers. SkyGuardian estimates disruption risk from available schedule data and
            explains its reasoning. Always confirm critical changes with your airline.
          </p>
        </div>
        <div className="space-y-3">
          <p className="eyebrow">Product</p>
          <ul className="text-sm">
            <li><Link href="/dashboard" className="inline-block py-2.5 text-ink-soft hover:text-ink">Dashboard</Link></li>
            <li><Link href="/history" className="inline-block py-2.5 text-ink-soft hover:text-ink">History</Link></li>
          </ul>
        </div>
        <div className="space-y-3">
          <p className="eyebrow">Learn</p>
          <ul className="text-sm">
            <li><Link href="/#how-it-works" className="inline-block py-2.5 text-ink-soft hover:text-ink">How it works</Link></li>
            <li><Link href="/#risk-engine" className="inline-block py-2.5 text-ink-soft hover:text-ink">Risk engine</Link></li>
            <li><Link href="/#responsible-ai" className="inline-block py-2.5 text-ink-soft hover:text-ink">Responsible AI</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-5 sm:px-8 pb-8 flex flex-wrap justify-between gap-3 eyebrow">
        <span>SkyGuardian AI · IT3041 project</span>
        <span>Predict the disruption. Protect the journey.</span>
      </div>
    </footer>
  );
}
