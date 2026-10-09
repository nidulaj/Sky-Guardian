import React from 'react';
import SiteHeader from '@/components/ui/SiteHeader';
import SiteFooter from '@/components/ui/SiteFooter';
import WindowIllustration from '@/components/ui/WindowIllustration';
import { Check } from 'lucide-react';

const POINTS = [
  'No passport or ID numbers needed',
  'Plain-language explanations for every flight',
  'You decide what to do, together with your airline',
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="solid" section="marketing" />
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12">
        {/* Cabin panel (decorative context, hidden on small screens) */}
        <aside
          aria-label="About SkyGuardian"
          className="relative hidden overflow-hidden rounded-4xl bg-gradient-to-br from-cabin-light via-cabin to-cabin-dark p-10 xl:p-12 text-white lg:flex lg:flex-col lg:gap-8"
        >
          <div className="flex items-start justify-between gap-6">
            <p className="font-mono text-xs uppercase tracking-label text-white/85">Seat 14A · Window</p>
            <WindowIllustration className="h-56 xl:h-64 w-auto shrink-0 -mr-2" />
          </div>

          <div className="mt-auto space-y-6">
            <h2 className="display text-5xl xl:text-6xl max-w-md">
              Calm answers when <span className="accent text-coral-peach">plans change.</span>
            </h2>
            <p className="text-lg leading-relaxed text-white max-w-md">
              SkyGuardian checks each flight and connection in your trip, explains the risk in plain words and suggests
              what to ask your airline.
            </p>
            <ul className="space-y-3 border-t border-white/20 pt-6">
              {POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-base text-white">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-coral-peach/25">
                    <Check className="h-3.5 w-3.5 text-coral-peach" aria-hidden="true" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="flex items-start justify-center lg:justify-start">
          <div className="w-full max-w-md lg:max-w-lg">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
