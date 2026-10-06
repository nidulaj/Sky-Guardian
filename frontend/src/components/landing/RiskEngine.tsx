import React from 'react';
import { Info } from 'lucide-react';
import SectionHeading from './SectionHeading';

const WEIGHTS = [
  { label: 'Flight', weight: 40, note: 'Delay, cancellation or diversion on any leg', bar: 'bg-ink' },
  { label: 'Connection', weight: 35, note: 'Transfer minutes against the minimum needed', bar: 'bg-coral-deep' },
  { label: 'Weather', weight: 25, note: 'Conditions at departure and transfer airports', bar: 'bg-mist-deep' },
];

const BANDS = [
  { label: 'Low', range: '0–29', span: 30, swatch: 'bg-status-safe', pill: 'bg-status-safe-bg text-status-safe', meaning: 'Your journey looks on track.' },
  { label: 'Moderate', range: '30–59', span: 30, swatch: 'bg-status-caution', pill: 'bg-status-caution-bg text-status-caution', meaning: 'Worth keeping an eye on.' },
  { label: 'High', range: '60–79', span: 20, swatch: 'bg-status-high', pill: 'bg-status-high-bg text-status-high', meaning: 'Rules and alternatives are checked for you.' },
  { label: 'Very high', range: '80–100', span: 20, swatch: 'bg-status-danger', pill: 'bg-status-danger-bg text-status-danger', meaning: 'Plan for disruption and contact your airline.' },
];

const EXAMPLE = [
  { label: 'Flight', score: 80, weight: 0.4 },
  { label: 'Connection', score: 90, weight: 0.35 },
  { label: 'Weather', score: 60, weight: 0.25 },
];

export default function RiskEngine() {
  const total = EXAMPLE.reduce((sum, row) => sum + row.score * row.weight, 0);
  return (
    <section id="risk-engine" aria-labelledby="risk-title" className="scroll-mt-4 px-2 sm:px-3">
      <div className="rounded-4xl bg-sand-100">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <SectionHeading
            id="risk-title"
            eyebrow="05 / Risk engine"
            aside="Same inputs, same score. Every time."
            title="A score you can"
            accent="check by hand."
            description="No hidden model decides your risk. Three signals, each scored 0–100, are combined with fixed weights you can see below."
          />

          <div className="mt-14 grid gap-6 lg:grid-cols-12">
            {/* Formula */}
            <div className="rounded-3xl border border-ink/10 bg-sand-50 p-6 sm:p-8 lg:col-span-7">
              <p className="eyebrow">The formula</p>
              <p className="mt-4 font-mono text-base leading-relaxed text-ink sm:text-lg">
                <span className="whitespace-nowrap">risk =</span>{' '}
                <span className="whitespace-nowrap">flight × 0.40</span>{' '}
                <span className="whitespace-nowrap">+ connection × 0.35</span>{' '}
                <span className="whitespace-nowrap">+ weather × 0.25</span>
              </p>

              <div className="mt-8 flex h-3 overflow-hidden rounded-full" aria-hidden="true">
                {WEIGHTS.map((w) => (
                  <div key={w.label} className={w.bar} style={{ width: `${w.weight}%` }} />
                ))}
              </div>

              <ul className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
                {WEIGHTS.map((w) => (
                  <li key={w.label} className="flex items-start gap-4 py-4">
                    <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${w.bar}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-ink">{w.label}</p>
                      <p className="text-sm leading-relaxed text-ink-soft">{w.note}</p>
                    </div>
                    <span className="display text-4xl text-ink sm:text-5xl">{w.weight}%</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-2xl bg-sand-200 p-5">
                <p className="eyebrow">Worked example · sample numbers</p>
                <p className="mt-3 font-mono text-sm leading-relaxed text-ink">
                  {EXAMPLE.map((row, i) => (
                    <React.Fragment key={row.label}>
                      {i > 0 && ' + '}
                      <span className="whitespace-nowrap">
                        {row.score} × {row.weight.toFixed(2)}
                      </span>
                    </React.Fragment>
                  ))}{' '}
                  = <strong className="font-semibold">{total.toFixed(1)}</strong> → High
                </p>
              </div>
            </div>

            {/* Bands */}
            <div className="flex flex-col rounded-3xl border border-ink/10 bg-sand-50 p-6 sm:p-8 lg:col-span-5">
              <p className="eyebrow">What the levels mean</p>

              <div className="mt-6" aria-hidden="true">
                <div className="flex h-3 gap-1">
                  {BANDS.map((b) => (
                    <div key={b.label} className={`${b.swatch} rounded-full`} style={{ width: `${b.span}%` }} />
                  ))}
                </div>
                <div className="mt-2 flex justify-between font-mono text-xs text-ink-muted">
                  <span>0</span>
                  <span>30</span>
                  <span>60</span>
                  <span>80</span>
                  <span>100</span>
                </div>
              </div>

              <ul className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
                {BANDS.map((b) => (
                  <li key={b.label} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-4">
                    <span
                      className={`inline-flex min-w-[6.5rem] items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-medium uppercase tracking-[0.08em] ${b.pill}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      {b.label}
                    </span>
                    <span className="font-mono text-sm text-ink">{b.range}</span>
                    <span className="w-full text-sm leading-relaxed text-ink-soft">
                      {b.meaning}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="hidden lg:block lg:flex-1" aria-hidden="true" />
              <div className="mt-6 flex gap-3 rounded-2xl border border-coral-deep/25 bg-coral-soft/60 p-5">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-coral-deep" aria-hidden="true" />
                <p className="text-base leading-relaxed text-ink">
                  <strong className="font-semibold">An estimate, not a probability.</strong> A score of 70 does not
                  mean a 70% chance of missing your flight. Always confirm changes with your airline.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
