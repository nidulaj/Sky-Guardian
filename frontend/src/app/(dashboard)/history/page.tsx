'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import { ArrowRight, Inbox } from 'lucide-react';

type Outcome = 'attention' | 'clear';

interface PastCheck {
  id: string;
  date: string;
  dateLabel: string;
  from: string;
  via?: string;
  to: string;
  places: string;
  flights: string;
  status: string;
  statusLabel: string;
  outcome: Outcome;
  finding: string;
  nextStep: string;
}

// Sample records that mirror the backend demo scenarios (mock flight provider).
const SAMPLE_CHECKS: PastCheck[] = [
  {
    id: 'sample-001',
    date: '2026-09-15',
    dateLabel: '15 Sep 2026',
    from: 'CMB',
    via: 'KUL',
    to: 'NRT',
    places: 'Colombo to Tokyo Narita via Kuala Lumpur',
    flights: 'UL001 · XX123',
    status: 'LIKELY_MISSED',
    statusLabel: 'Connection likely missed',
    outcome: 'attention',
    finding: 'UL001 is 90 min late, leaving 30 min at KUL where 60 min is needed.',
    nextStep: 'Ask the airline about protecting the connection or a next-day flight.',
  },
  {
    id: 'sample-002',
    date: '2026-08-10',
    dateLabel: '10 Aug 2026',
    from: 'CMB',
    via: 'SIN',
    to: 'NRT',
    places: 'Colombo to Tokyo Narita via Singapore',
    flights: 'UL306 · SQ638',
    status: 'ON_TIME',
    statusLabel: 'Connection OK',
    outcome: 'clear',
    finding: 'Both flights on time, with 120 min to change planes at SIN.',
    nextStep: 'No action needed. Check again on the day of travel.',
  },
  {
    id: 'sample-003',
    date: '2026-07-22',
    dateLabel: '22 Jul 2026',
    from: 'CMB',
    to: 'LHR',
    places: 'Colombo to London Heathrow, direct',
    flights: 'UL504',
    status: 'CANCELLED',
    statusLabel: 'Flight cancelled',
    outcome: 'attention',
    finding: 'The flight was reported as cancelled.',
    nextStep: 'Contact the airline for rebooking or a refund.',
  },
];

const FILTERS: { key: 'all' | Outcome; label: string }[] = [
  { key: 'all', label: 'All checks' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'clear', label: 'All clear' },
];

const primaryLink =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-base font-medium text-sand-50 transition-colors hover:bg-ink-soft';

function Route({ check, large = false }: { check: PastCheck; large?: boolean }) {
  const size = large ? 'text-3xl' : 'text-xl';
  return (
    <span className="block">
      <span className="sr-only">{check.places}</span>
      <span aria-hidden="true" className={`display ${size} text-ink inline-flex items-center gap-2 whitespace-nowrap`}>
        <span>{check.from}</span>
        {check.via && (
          <>
            <span className="h-px w-4 border-t border-dashed border-coral" />
            <span className="text-ink-muted">{check.via}</span>
          </>
        )}
        <span className="h-px w-4 border-t border-dashed border-coral" />
        <span>{check.to}</span>
      </span>
    </span>
  );
}

export default function HistoryPage() {
  const [filter, setFilter] = useState<'all' | Outcome>('all');
  const rows = SAMPLE_CHECKS.filter((c) => filter === 'all' || c.outcome === filter);

  return (
    <div className="space-y-10 sm:space-y-12">
      <PageHeader
        eyebrow="02 / History"
        title="Every journey,"
        accent="remembered."
        description="Past checks, with what SkyGuardian found and the step it suggested. Open a new check to get up-to-date results."
        actions={
          <Link href="/journeys/new" className={primaryLink}>
            Check a journey
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />


      <section aria-labelledby="checks-heading" className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="checks-heading" className="eyebrow">
            {rows.length} {rows.length === 1 ? 'check' : 'checks'} shown
          </h2>
          <div role="group" aria-label="Filter checks" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.key)}
                  className={`h-11 rounded-full px-4 text-sm font-medium transition-colors ${
                    active ? 'bg-ink text-sand-50' : 'border border-ink/15 bg-sand-50 text-ink-soft hover:border-ink/40 hover:text-ink'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block surface overflow-hidden">
              <table className="w-full text-left">
                <caption className="sr-only">Journey checks</caption>
                <thead>
                  <tr className="border-b border-ink/10">
                    <th scope="col" className="eyebrow px-6 py-4 font-normal">Date</th>
                    <th scope="col" className="eyebrow px-6 py-4 font-normal">Route</th>
                    <th scope="col" className="eyebrow px-6 py-4 font-normal">Result</th>
                    <th scope="col" className="eyebrow px-6 py-4 font-normal">What we found</th>
                    <th scope="col" className="eyebrow px-6 py-4 font-normal">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {rows.map((c) => (
                    <tr key={c.id} className="align-top transition-colors hover:bg-sand-50">
                      <td className="px-6 py-6 text-base text-ink whitespace-nowrap">
                        <time dateTime={c.date}>{c.dateLabel}</time>
                      </td>
                      <td className="px-6 py-6">
                        <Route check={c} />
                        <p className="mt-1.5 text-sm text-ink-muted">{c.flights}</p>
                      </td>
                      <td className="px-6 py-6">
                        <Badge status={c.status} label={c.statusLabel} />
                      </td>
                      <td className="px-6 py-6 max-w-md">
                        <p className="text-base text-ink">{c.finding}</p>
                        <p className="mt-1.5 text-sm text-ink-soft">
                          <span className="font-medium text-ink">Next step:</span> {c.nextStep}
                        </p>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <Link
                          href="/journeys/new"
                          className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full border border-ink/15 bg-sand-50 px-4 text-sm font-medium text-ink transition-colors hover:border-ink/40"
                        >
                          Check again
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">: {c.places}</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile and tablet cards */}
            <ul className="grid gap-4 md:grid-cols-2 lg:hidden">
              {rows.map((c) => (
                <li key={c.id} className="surface p-5 sm:p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <time dateTime={c.date} className="eyebrow">
                      {c.dateLabel}
                    </time>
                    <span className="text-sm text-ink-muted">{c.flights}</span>
                  </div>
                  <Route check={c} large />
                  <div>
                    <Badge status={c.status} label={c.statusLabel} />
                  </div>
                  <div className="border-t border-ink/10 pt-4 space-y-2">
                    <p className="text-base text-ink">{c.finding}</p>
                    <p className="text-sm text-ink-soft">
                      <span className="font-medium text-ink">Next step:</span> {c.nextStep}
                    </p>
                  </div>
                  <Link
                    href="/journeys/new"
                    className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-full border border-ink/15 bg-sand-50 px-4 text-sm font-medium text-ink transition-colors hover:border-ink/40"
                  >
                    Check again
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">: {c.places}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
        Results reflect the schedule data available at the time of each check. Risk levels are rule-based estimates, not
        probabilities. Always confirm changes with your airline.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-ink/25 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sand-100 text-ink-soft">
        <Inbox className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <p className="text-xl font-semibold tracking-tight text-ink">Nothing here yet</p>
        <p className="text-base text-ink-soft max-w-md">
          No checks match this filter. Try another filter, or check a journey to see fresh results.
        </p>
      </div>
      <Link
        href="/journeys/new"
        className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-sand-50 transition-colors hover:bg-ink-soft"
      >
        Check a journey
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
