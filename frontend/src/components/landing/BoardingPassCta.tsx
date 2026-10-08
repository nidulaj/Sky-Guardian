import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Plane } from 'lucide-react';
import Barcode from '@/components/ui/Barcode';

const STOPS = [
  { code: 'CMB', city: 'Colombo', role: 'From' },
  { code: 'KUL', city: 'Kuala Lumpur', role: 'Transfer' },
  { code: 'NRT', city: 'Tokyo Narita', role: 'To' },
];

const FIELDS = [
  { label: 'Leg 1', value: 'UL001', note: 'Delayed 90 min' },
  { label: 'Leg 2', value: 'XX123', note: 'On time' },
  { label: 'Time at KUL', value: '30 min', note: 'After the delay' },
  { label: 'Minimum needed', value: '60 min', note: 'Connection time' },
];

function RouteLine() {
  return (
    <div className="flex flex-1 items-center gap-1 px-1 sm:gap-2 sm:px-3" aria-hidden="true">
      <span className="h-px flex-1 border-t border-dashed border-coral-deep/60" />
      <Plane className="h-4 w-4 shrink-0 rotate-45 text-coral sm:h-5 sm:w-5" />
      <span className="h-px flex-1 border-t border-dashed border-coral-deep/60" />
    </div>
  );
}

export default function BoardingPassCta() {
  return (
    <section aria-labelledby="demo-title" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-ink/15 py-4">
        <p className="eyebrow">06 / Try it</p>
        <p className="eyebrow hidden sm:block">Sample journey · SG-DEMO</p>
        <p className="eyebrow">No booking needed</p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-12 lg:items-end">
        <h2 id="demo-title" className="display text-4xl text-ink sm:text-5xl lg:col-span-7 lg:text-6xl">
          Two flights, one tight transfer. <span className="accent text-coral">See it checked.</span>
        </h2>
        <p className="text-base leading-relaxed text-ink-soft sm:text-lg lg:col-span-5">
          Our demo journey uses sample data: the first flight lands late in Kuala Lumpur and leaves too little time to
          connect. Run it to see every agent at work.
        </p>
      </div>

      <div className="mt-12 flex flex-col drop-shadow-[0_20px_30px_rgba(26,23,20,0.10)] md:flex-row">
        {/* Main pass */}
        <div className="relative flex-1 rounded-t-3xl bg-sand-50 p-6 sm:p-10 md:rounded-l-3xl md:rounded-tr-none">
          <div className="flex items-center justify-between gap-4 border-b border-ink/15 pb-4">
            <p className="eyebrow">SkyGuardian · Journey check</p>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-mist-soft px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-mist-deep">
              Demo data
            </span>
          </div>

          <div className="mt-8 flex items-start">
            {STOPS.map((stop, i) => (
              <React.Fragment key={stop.code}>
                {i > 0 && (
                  <div className="flex flex-1 self-stretch pb-12 sm:pb-14">
                    <RouteLine />
                  </div>
                )}
                <div className={i === 1 ? 'text-center' : i === 2 ? 'text-right' : ''}>
                  <p className="eyebrow">{stop.role}</p>
                  <p className="display mt-2 text-[2.5rem] text-ink sm:text-6xl lg:text-7xl">{stop.code}</p>
                  <p className="mt-2 text-sm text-ink-soft">{stop.city}</p>
                </div>
              </React.Fragment>
            ))}
          </div>

          <dl className="mt-10 grid grid-cols-2 border-y border-ink/15 lg:grid-cols-4">
            {FIELDS.map((field, i) => (
              <div
                key={field.label}
                className={`py-4 pr-4 ${i % 2 === 1 ? 'border-l border-ink/15 pl-4' : ''} ${
                  i >= 2 ? 'border-t border-ink/15 lg:border-t-0' : ''
                } ${i === 2 ? 'lg:border-l lg:pl-4' : ''}`}
              >
                <dt className="eyebrow">{field.label}</dt>
                <dd className="mt-2">
                  <span className="block text-xl font-medium text-ink">{field.value}</span>
                  <span className="block text-sm text-ink-soft">{field.note}</span>
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 font-mono text-xs text-ink-muted">Sample scenario for demonstration. Not a real booking.</p>

        </div>

        {/* Stub */}
        <div className="relative flex flex-col rounded-b-3xl border-t-2 border-dashed border-white/50 bg-coral-deep p-6 text-white sm:p-8 md:w-[340px] md:rounded-bl-none md:rounded-tr-3xl md:border-l-2 md:border-t-0">
          {/* Perforation notches at the tear line */}
          <span aria-hidden="true" className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-sand-200" />
          <span aria-hidden="true" className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-sand-200 md:hidden" />
          <span aria-hidden="true" className="absolute -bottom-3 -left-3 hidden h-6 w-6 rounded-full bg-sand-200 md:block" />
          <p className="font-mono text-[11px] uppercase tracking-label text-white">Your stub</p>
          <p className="display mt-4 flex items-center gap-3 text-4xl sm:text-5xl">
            CMB <span className="text-2xl font-normal" aria-hidden="true">→</span> NRT
          </p>
          <dl className="mt-6 space-y-2 border-t border-white/30 pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="font-mono uppercase tracking-[0.08em]">Via</dt>
              <dd className="font-medium">KUL</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-mono uppercase tracking-[0.08em]">Connection</dt>
              <dd className="font-medium">Likely missed</dd>
            </div>
          </dl>
          <Barcode value="SG-DEMO-CMB-KUL-NRT" className="mt-6 h-14 w-full text-white" />
          <div className="flex-1" aria-hidden="true" />
          <Link
            href="/journeys/new"
            className="group mt-6 inline-flex min-h-[56px] items-center justify-between gap-3 rounded-2xl bg-white px-5 text-base font-medium text-coral-deep transition-colors hover:bg-sand-50"
          >
            Try the demo journey
            <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
