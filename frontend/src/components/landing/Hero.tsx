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
      <div className="relative isolate overflow-hidden rounded-4xl bg-gradient-to-br from-cabin-light via-cabin to-cabin-dark text-white lg:min-h-[760px]">
        {/*
          Background video. Drop the file at public/videos/hero.mp4; until it exists the
          cabin gradient shows as before. Hidden for people who prefer reduced motion.
        */}
        <video
          className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover motion-reduce:hidden"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src="/videos/hero.mp4" type="video/mp4" />
        </video>
        {/* Cabin-tone overlay keeps the white hero text readable over any footage. */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-cabin-dark/85 via-cabin-dark/55 to-cabin-dark/25"
          aria-hidden="true"
        />
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
                href="/dashboard"
                className="inline-flex h-14 items-center gap-3 rounded-full bg-sand-50 px-7 text-base font-medium text-ink transition-colors hover:bg-white"
              >
                Go to Dashboard
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
            className="pointer-events-none relative mx-auto -mb-16 mt-12 w-[55%] max-w-[220px] sm:max-w-[250px] lg:absolute lg:bottom-auto lg:right-4 lg:top-[52%] lg:mx-0 lg:mb-0 lg:mt-0 lg:w-[24%] lg:max-w-[300px] lg:-translate-y-1/2 xl:right-10 xl:w-[22%]"
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
