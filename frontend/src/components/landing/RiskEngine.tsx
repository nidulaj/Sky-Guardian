import React from 'react';
import { AlertTriangle, ArrowLeftRight, CloudSun, Info, Plane, ShieldCheck } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import SectionHeading from './SectionHeading';

// Mirrors config/risk.yaml (the Risk agent's single source of truth). Update both together.
const WEIGHTS = [
  { key: 'flight', label: 'Flight', weight: 40, note: 'Delay, cancellation or diversion on any leg', bar: 'bg-sand-50', Icon: Plane },
  { key: 'connection', label: 'Connection', weight: 35, note: 'Transfer minutes against the minimum needed', bar: 'bg-coral', Icon: ArrowLeftRight },
  { key: 'weather', label: 'Weather', weight: 25, note: 'Conditions at departure, transfer and arrival airports', bar: 'bg-mist', Icon: CloudSun },
];

const BANDS = [
  { status: 'LOW', label: 'Low', range: '0–29', span: 30, fill: 'bg-status-safe-bg', meaning: 'Your journey looks on track.' },
  { status: 'MODERATE', label: 'Moderate', range: '30–59', span: 30, fill: 'bg-status-caution-bg', meaning: 'Worth keeping an eye on.' },
  { status: 'HIGH', label: 'High', range: '60–79', span: 20, fill: 'bg-coral-peach', meaning: 'Rules and alternatives are checked for you.' },
  { status: 'VERY_HIGH', label: 'Very high', range: '80–100', span: 20, fill: 'bg-coral', meaning: 'Plan for disruption and contact your airline.' },
];

// How each agent result becomes a 0-100 part score.
const SCORING = [
  {
    label: 'Flight',
    source: 'Flight agent · worst leg counts',
    Icon: Plane,
    rows: [
      ['On time', '0'], ['Up to 15 min late', '10'], ['Up to 30 min', '25'], ['Up to 60 min', '45'],
      ['Up to 90 min', '65'], ['Up to 120 min', '80'], ['Over 120 min', '95'], ['Diverted', '90'], ['Cancelled', '100'],
    ],
  },
  {
    label: 'Connection',
    source: 'Connection agent · worst transfer counts',
    Icon: ArrowLeftRight,
    rows: [['Safe', '10'], ['Moderate risk', '40'], ['High risk', '70'], ['Likely missed', '90'], ['Missed', '100']],
  },
  {
    label: 'Weather',
    source: 'Weather agent · worst airport counts',
    Icon: CloudSun,
    rows: [['Rain and snow', 'up to 35'], ['Thunderstorms', 'up to 30'], ['Wind', 'up to 28'], ['Visibility', 'up to 28'], ['Official alerts', 'up to 30']],
    note: 'Capped at 100. Rain, snow and storms usually come together, so they are not double-counted.',
  },
];

// The demo journey (UL001 CMB→KUL, then XX123 KUL→NRT), as the Risk agent scores it.
const EXAMPLE = [
  { label: 'Flight', score: 65, weight: 0.4, why: 'UL001 is 90 min late' },
  { label: 'Connection', score: 90, weight: 0.35, why: '30 min at KUL, 60 needed' },
  { label: 'Weather', score: 60, weight: 0.25, why: 'Storms forecast at KUL' },
];

const SAFEGUARDS = [
  { title: 'Missing data is never 0', text: 'If an agent has no data, that part is left out, the other weights are scaled up and confidence drops.' },
  { title: 'Cancellations count fully', text: 'A cancelled flight puts the journey at 90 or more, whatever the weather.' },
  { title: 'Missed connections too', text: 'A connection that cannot be made puts the journey at 80 or more.' },
];

const RUNWAY_IMAGE = '/images/risk/runway-sunset.jpg';
// Light inner panel, same as the weather risk widget.
const panel = (extra = '') => `rounded-3xl border border-ink/10 bg-sand-100 ${extra}`;

export default function RiskEngine() {
  const weighted = EXAMPLE.reduce((sum, row) => sum + row.score * row.weight, 0);
  const rounded = Math.floor(weighted + 0.5 + 1e-9); // the Risk agent rounds halves up

  return (
    <section id="risk-engine" aria-labelledby="risk-title" className="scroll-mt-4">
      <div className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 sm:pb-28">
        <SectionHeading
          id="risk-title"
          eyebrow="Risk engine"
          title="A score you can"
          accent="check by hand."
          description="No hidden model decides your risk. The Risk agent takes the Flight, Connection and Weather agent results, scores each 0–100 and combines them with fixed weights you can see below."
        />

        <div className="surface-raised mt-14 space-y-5 p-5 sm:p-8">
          <div className="grid gap-5 lg:grid-cols-12">
            {/* Formula: the one photo panel, like "Now at the airport" in the weather card */}
            <div
              className="relative isolate overflow-hidden rounded-3xl bg-cabin-dark bg-cover bg-top p-6 text-sand-50 sm:p-8 lg:col-span-7"
              style={{ backgroundImage: `url('${RUNWAY_IMAGE}')` }}
            >
              {/* Darkens the runway photo so white text stays readable (WCAG AA). */}
              <div
                className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(43,36,31,0.55)_0%,rgba(43,36,31,0.85)_35%,rgba(43,36,31,0.95)_100%)]"
                aria-hidden="true"
              />
              <p className="eyebrow text-sand-100">The formula</p>
              <p className="mt-4 font-mono text-base leading-relaxed text-white sm:text-lg">
                <span className="whitespace-nowrap">risk =</span>{' '}
                <span className="whitespace-nowrap">flight × 0.40</span>{' '}
                <span className="whitespace-nowrap">+ connection × 0.35</span>{' '}
                <span className="whitespace-nowrap">+ weather × 0.25</span>
              </p>

              <div className="mt-8 flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                {WEIGHTS.map((w) => (
                  <div key={w.key} className={w.bar} style={{ width: `${w.weight}%` }} />
                ))}
              </div>

              <ul className="mt-6 divide-y divide-sand-50/10 border-y border-sand-50/10">
                {WEIGHTS.map(({ key, label, weight, note, bar, Icon }) => (
                  <li key={key} className="flex items-center gap-4 py-4">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sand-50/15">
                      <Icon className="h-4 w-4 text-coral-peach" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-lg font-medium text-white">
                        <span className={`h-2 w-2 rounded-full ${bar}`} aria-hidden="true" />
                        {label}
                      </p>
                      <p className="text-sm leading-relaxed text-sand-200">{note}</p>
                    </div>
                    <span className="display text-4xl text-white tabular-nums sm:text-5xl">{weight}%</span>
                  </li>
                ))}
              </ul>

              {/* Worked example */}
              <div className="mt-6 rounded-2xl border border-sand-50/10 bg-sand-50/5 p-5">
                <p className="eyebrow text-sand-200">Worked example · CMB → KUL → NRT</p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                  {EXAMPLE.map((row) => (
                    <li key={row.label}>
                      <p className="text-sm text-sand-200">{row.label}</p>
                      <p className="display text-3xl text-white tabular-nums">
                        {row.score}
                        <span className="text-base text-sand-200"> × {row.weight.toFixed(2)}</span>
                      </p>
                      <p className="text-sm text-sand-100">{row.why}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-sand-50/10 pt-4 font-mono text-sm text-sand-100">
                  <span>
                    {EXAMPLE.map((r) => (r.score * r.weight).toFixed(1).replace(/\.0$/, '')).join(' + ')} ={' '}
                    <strong className="font-semibold text-white">{weighted.toFixed(1)}</strong> → {rounded}
                  </span>
                  <Badge status="HIGH" label="High risk" />
                </p>
              </div>
            </div>

            {/* Levels */}
            <div className={panel('flex flex-col p-6 sm:p-8 lg:col-span-5')}>
              <p className="eyebrow">What the levels mean</p>

              <div className="mt-6" aria-hidden="true">
                <div className="flex h-3 gap-1">
                  {BANDS.map((b) => (
                    <div key={b.status} className={`${b.fill} rounded-full`} style={{ width: `${b.span}%` }} />
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
                  <li key={b.status} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-4">
                    <Badge status={b.status} label={b.label} className="min-w-[6.5rem]" />
                    <span className="font-mono text-sm text-ink">{b.range}</span>
                    <span className="w-full text-sm leading-relaxed text-ink-soft">{b.meaning}</span>
                  </li>
                ))}
              </ul>

              <div className="hidden lg:block lg:flex-1" aria-hidden="true" />
              <div className="mt-6 flex gap-3 rounded-2xl border border-coral/30 bg-coral/10 p-5">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-coral-deep" aria-hidden="true" />
                <p className="text-base leading-relaxed text-ink-soft">
                  <strong className="font-semibold text-ink">An estimate, not a probability.</strong> A score of 70 does not
                  mean a 70% chance of missing your flight. Always confirm changes with your airline.
                </p>
              </div>
            </div>
          </div>

          {/* How each part is scored */}
          <div className="grid gap-5 md:grid-cols-3">
            {SCORING.map(({ label, source, Icon, rows, note }) => (
              <div key={label} className={panel('p-6')}>
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15">
                    <Icon className="h-4 w-4 text-coral-deep" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-lg font-medium text-ink">{label} score</p>
                    <p className="font-mono text-xs uppercase tracking-label text-ink-muted">{source}</p>
                  </div>
                </div>
                <dl className="mt-4 divide-y divide-ink/10 text-sm">
                  {rows.map(([what, pts]) => (
                    <div key={what} className="flex justify-between gap-4 py-2">
                      <dt className="text-ink-soft">{what}</dt>
                      <dd className="font-mono text-ink tabular-nums">{pts}</dd>
                    </div>
                  ))}
                </dl>
                {note && <p className="mt-3 text-sm leading-relaxed text-ink-muted">{note}</p>}
              </div>
            ))}
          </div>

          {/* Safeguards */}
          <div className={panel('p-6 sm:p-8')}>
            <p className="eyebrow flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Built-in safeguards
            </p>
            <ul className="mt-5 grid gap-6 md:grid-cols-3">
              {SAFEGUARDS.map((s) => (
                <li key={s.title} className="flex gap-3">
                  <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-status-caution" aria-hidden="true" />
                  <div>
                    <p className="text-base font-medium text-ink">{s.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
