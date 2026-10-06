import React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';
import SiteHeader from '@/components/ui/SiteHeader';
import WindowIllustration from '@/components/ui/WindowIllustration';

const FACTS = [
  { label: 'Agents', value: '7 specialists, one answer' },
  { label: 'Risk score', value: 'Open formula, 0–100' },
  { label: 'Sample trip', value: 'CMB → KUL → NRT' },
];

export default function Hero() {
  return (
    <section aria-labelledby="hero-title" className="px-2 pt-2 sm:px-3 sm:pt-3">
      <div className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-cabin-light via-cabin to-cabin-dark text-white lg:min-h-[760px]">
        <SiteHeader variant="overlay" section="marketing" />

        <div className="relative mx-auto max-w-7xl px-5 pt-28 sm:px-8 sm:pt-36 lg:pt-44">
          <div className="relative z-10 max-w-xl lg:max-w-[540px] xl:max-w-2xl">
            <p className="animate-fade-up font-mono text-[11px] uppercase tracking-label text-white/80">
              Flight disruption intelligence · for connecting trips
            </p>
            <h1
              id="hero-title"
              className="display mt-6 animate-fade-up text-[3.25rem] sm:text-7xl xl:text-8xl [animation-delay:80ms]"
            >
              Predict the disruption. <span className="accent text-coral-peach">Protect the journey.</span>
            </h1>
            <p className="mt-7 max-w-lg animate-fade-up text-lg leading-relaxed text-white/85 [animation-delay:160ms]">
              SkyGuardian checks every flight in your trip, works out whether your connection still holds, and
              explains your options in plain language before you reach the gate.
            </p>

            <div className="mt-9 flex animate-fade-up flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8 [animation-delay:240ms]">
              <Link
                href="/journeys/new"
                className="inline-flex h-14 items-center gap-3 rounded-full bg-sand-50 px-7 text-base font-medium text-ink transition-colors hover:bg-white"
              >
                Check my journey
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="link-line min-h-[44px] text-white">
                See how it works
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Window: in the flow on small screens (cropped by the panel), absolutely placed on large screens */}
          <div
            aria-hidden="true"
            className="pointer-events-none relative mx-auto -mb-24 mt-14 w-[78%] max-w-[340px] sm:max-w-[400px] lg:absolute lg:bottom-auto lg:right-0 lg:top-[52%] lg:mx-0 lg:mb-0 lg:mt-0 lg:w-[38%] lg:max-w-none lg:-translate-y-1/2 xl:right-4 xl:w-[40%]"
          >
            <WindowIllustration className="h-auto w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.35)]" />
          </div>

          <dl className="relative z-10 mt-0 hidden grid-cols-3 gap-8 border-t border-white/15 py-8 lg:mt-24 lg:grid lg:max-w-[58%]">
            {FACTS.map((fact) => (
              <div key={fact.label}>
                <dt className="font-mono text-[11px] uppercase tracking-label text-white/70">{fact.label}</dt>
                <dd className="mt-2 text-base text-white">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
