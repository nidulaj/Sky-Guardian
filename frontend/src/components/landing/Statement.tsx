import React from 'react';

const FACTS = [
  {
    n: '01',
    title: 'Every leg, not just one flight',
    body: 'We read the status of each flight in your trip, so a delay on the first leg shows up where it matters: at your transfer.',
  },
  {
    n: '02',
    title: 'The transfer maths, shown',
    body: 'Minutes you actually have at the hub against the minimum the airport needs. No black box.',
  },
  {
    n: '03',
    title: 'Options before the gate',
    body: 'If the connection looks tight, you get rebooking options and the airline rules behind them.',
  },
];

export default function Statement() {
  return (
    <section aria-labelledby="statement-title" className="px-2 pt-2 sm:px-3 sm:pt-3">
      <div className="rounded-4xl bg-sand-400">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="eyebrow text-ink-soft">
              Why SkyGuardian
            </p>
          </div>

          <div className="mt-14 grid gap-12 lg:mt-20 lg:grid-cols-12 lg:items-end">
            <h2 id="statement-title" className="display text-[2.75rem] text-ink sm:text-7xl lg:col-span-8 xl:text-[6.5rem]">
              Airlines track flights.
              <br />
              We track your <span className="accent text-coral-deep">connection.</span>
            </h2>

            {/* Example transfer card */}
            <figure className="rounded-3xl border border-ink/10 bg-sand-100 p-6 lg:col-span-4">
              <figcaption>
                <span className="eyebrow">Transfer at KUL</span>
              </figcaption>
              <div className="mt-6 space-y-4">
                <div>
                  <div className="flex items-baseline justify-between text-sm text-ink-soft">
                    <span>Time you have</span>
                    <span className="font-mono text-ink">30 min</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sand-300" aria-hidden="true">
                    <div className="h-full w-1/2 rounded-full bg-coral-deep" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between text-sm text-ink-soft">
                    <span>Minimum needed</span>
                    <span className="font-mono text-ink">60 min</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sand-300" aria-hidden="true">
                    <div className="h-full w-full rounded-full bg-ink" />
                  </div>
                </div>
              </div>
              <p className="mt-6 border-t border-ink/10 pt-4 text-base leading-relaxed text-ink-soft">
                First flight lands 90 minutes late. The connection is{' '}
                <strong className="font-semibold text-status-danger">likely missed</strong>, even though the
                second flight is on time.
              </p>
            </figure>
          </div>

          <ul className="mt-16 grid gap-8 border-t border-ink/20 pt-8 sm:grid-cols-3 lg:mt-24">
            {FACTS.map((fact) => (
              <li key={fact.n} className="space-y-2">
                <p className="font-mono text-xs text-ink-soft">{fact.n}</p>
                <h3 className="text-lg font-semibold text-ink">{fact.title}</h3>
                <p className="text-base leading-relaxed text-ink-soft">{fact.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
