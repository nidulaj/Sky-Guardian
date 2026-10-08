'use client';

import React from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Barcode from '@/components/ui/Barcode';
import { ArrowRight, Info, Plane, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import PassengerPolicyAssistant from '@/components/dashboard/PassengerPolicyAssistant';

const primaryLink =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-base font-medium text-sand-50 transition-colors hover:bg-ink-soft';

// Sample journey, consistent with the backend demo scenario (mock flight provider).
const SAMPLE_TIMELINE = [
  {
    time: '15:30',
    note: 'Scheduled',
    label: 'Leg 1 · UL001',
    title: 'Colombo (CMB) to Kuala Lumpur (KUL)',
    body: 'Now expected to land at 17:00 UTC, 90 minutes later than planned.',
    status: 'DELAYED',
    statusLabel: 'Delayed 90 min',
  },
  {
    time: '17:00',
    note: 'Expected',
    label: 'Connection · KUL',
    title: '30 minutes to change planes',
    body: 'Kuala Lumpur needs at least 60 minutes for this transfer, so the connection is likely to be missed.',
    status: 'LIKELY_MISSED',
    statusLabel: 'Likely missed',
  },
  {
    time: '17:30',
    note: 'Departs',
    label: 'Leg 2 · XX123',
    title: 'Kuala Lumpur (KUL) to Tokyo Narita (NRT)',
    body: 'Currently on time. It may leave before you can reach the gate.',
    status: 'ON_TIME',
    statusLabel: 'On time',
  },
];

const SAMPLE_STATS = [
  { value: '3', label: 'Journeys checked', note: 'Sample history' },
  { value: '1', label: 'Connection at risk', note: 'CMB → KUL → NRT' },
  { value: '1', label: 'Cancelled flight', note: 'CMB → LHR' },
];

const NEXT_STEPS = [
  'Contact SriLankan Airlines before you leave Colombo and ask whether your onward flight can be protected.',
  'If you still travel, go straight to the transfer desk at Kuala Lumpur when you land.',
  'Ask the airline about rebooking. In this sample, a next-day flight (MH088, 08:30) is one option to raise with them.',
];

export default function DashboardPage() {
  const { user, isAdmin, isAuthenticated } = useAuth();

  return (
    <div className="space-y-12 sm:space-y-16">
      <PageHeader
        eyebrow={user?.first_name ? `Welcome back, ${user.first_name} · ${user.role}` : '01 / Dashboard'}
        title="Your journeys,"
        accent="at a glance."
        description={
          user?.first_name
            ? `Signed in as ${user.email}. Check flight disruptions, examine connection risks, or ask questions to the airline policy assistant below.`
            : 'See which trips need attention and what to do next. Start a new check any time. It takes about a minute.'
        }
        actions={
          <div className="flex flex-wrap gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-coral bg-coral-peach/15 px-6 text-base font-medium text-coral-deep transition-colors hover:bg-coral hover:text-white"
              >
                <ShieldCheck className="h-4 w-4" />
                Admin Portal
              </Link>
            )}
            <Link href="/journeys/new" className={primaryLink}>
              Check a journey
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        }
      />

      {/* Admin Quick Callout if logged in as Admin */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-coral/30 bg-sand-50 p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-coral shrink-0" />
            <div>
              <p className="font-semibold text-ink text-base">Administrator Mode Active</p>
              <p className="text-sm text-ink-soft">
                You have administrative access to the Supabase Knowledge Base, document ingestion, and vector store metrics.
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-coral px-4 text-xs font-medium text-white transition-colors hover:bg-coral-deep shrink-0"
          >
            Open Admin Vault
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Passenger RAG Policy Assistant Widget */}
      <PassengerPolicyAssistant />

      {/* Honest sample-data notice */}
      <div role="note" className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-mist-soft px-5 py-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-mist-deep" aria-hidden="true" />
        <p className="text-base text-ink">
          <strong className="font-semibold">Sample data.</strong>{' '}
          <span className="text-ink-soft">
            {isAuthenticated
              ? `You are logged in as ${user?.role}. The card below displays an example multi-leg journey with simulated delay status so you can preview how risk scoring appears.`
              : 'Journey history is saved once accounts are connected. Until then, this page shows an example trip so you can see how results look.'}
          </span>
        </p>
      </div>


      {/* Upcoming trip: boarding pass */}
      <section aria-labelledby="upcoming-heading" className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="eyebrow">02 / Upcoming trip</p>
          <p className="eyebrow">Sample · 15 Sep 2026</p>
        </div>
        <h2 id="upcoming-heading" className="sr-only">
          Upcoming trip (sample): Colombo to Tokyo via Kuala Lumpur
        </h2>

        <div className="grid lg:grid-cols-[1fr_320px]">
          {/* Main pass */}
          <div className="rounded-t-3xl lg:rounded-tr-none lg:rounded-l-3xl border border-ink/10 bg-sand-50 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
              <span className="eyebrow">SkyGuardian / Journey check</span>
              <Badge status="DEMO_DATA" label="Sample data" />
            </div>

            <div className="grid grid-cols-[auto_1fr_auto] items-end gap-3 sm:gap-6 pt-8">
              <div>
                <p className="eyebrow">From</p>
                <p className="display text-6xl sm:text-7xl lg:text-8xl text-ink mt-2">CMB</p>
              </div>
              <div className="flex flex-col items-center pb-4 sm:pb-6" aria-hidden="true">
                <div className="flex w-full items-center gap-2">
                  <span className="h-px flex-1 border-t border-dashed border-coral" />
                  <Plane className="h-5 w-5 rotate-45 text-coral" />
                  <span className="h-px flex-1 border-t border-dashed border-coral" />
                </div>
                <span className="eyebrow mt-2 hidden sm:block">via KUL</span>
              </div>
              <div className="text-right">
                <p className="eyebrow">To</p>
                <p className="display text-6xl sm:text-7xl lg:text-8xl text-ink mt-2">NRT</p>
              </div>
            </div>
            <div className="mt-3 flex justify-between gap-4 text-sm text-ink-muted">
              <span>Colombo</span>
              <span className="sm:hidden">via Kuala Lumpur</span>
              <span>Tokyo Narita</span>
            </div>

            <dl className="mt-8 grid grid-cols-2 md:grid-cols-4 border-y border-ink/10">
              <div className="py-4 pr-4">
                <dt className="eyebrow">Date</dt>
                <dd className="mt-1.5 text-base sm:text-lg text-ink">15 Sep 2026</dd>
              </div>
              <div className="py-4 pl-4 border-l border-ink/10">
                <dt className="eyebrow">Flights</dt>
                <dd className="mt-1.5 text-base sm:text-lg text-ink">UL001 · XX123</dd>
              </div>
              <div className="py-4 pr-4 border-t border-ink/10 md:border-t-0 md:border-l md:pl-4">
                <dt className="eyebrow">Time at KUL</dt>
                <dd className="mt-1.5 text-base sm:text-lg text-ink">30 of 60 min needed</dd>
              </div>
              <div className="py-4 pl-4 border-l border-t border-ink/10 md:border-t-0">
                <dt className="eyebrow">Connection</dt>
                <dd className="mt-2">
                  <Badge status="LIKELY_MISSED" />
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-ink-muted">
              Times in UTC. Based on sample schedule data, not a live feed.
            </p>
          </div>

          {/* Perforated stub */}
          <div className="relative rounded-b-3xl lg:rounded-bl-none lg:rounded-r-3xl bg-coral-deep p-6 sm:p-8 text-white flex flex-col gap-6">
            <span
              aria-hidden="true"
              className="absolute inset-x-6 top-0 border-t-2 border-dashed border-white/40 lg:inset-x-auto lg:inset-y-6 lg:left-0 lg:border-t-0 lg:border-l-2"
            />
            <span aria-hidden="true" className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-sand-200 lg:-top-3 lg:-left-3" />
            <span aria-hidden="true" className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-sand-200 lg:hidden" />
            <span aria-hidden="true" className="absolute -bottom-3 -left-3 h-6 w-6 rounded-full bg-sand-200 hidden lg:block" />

            <div>
              <p className="font-mono text-[11px] uppercase tracking-label text-white">Connection at KUL</p>
              <p className="display mt-3 text-5xl">30 min</p>
              <p className="mt-2 text-base text-white">available, 60 min needed</p>
            </div>

            <dl className="space-y-2 border-t border-white/30 pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt>UL001</dt>
                <dd className="font-medium">+90 min late</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Overall risk</dt>
                <dd className="font-medium">High</dd>
              </div>
            </dl>

            <Barcode value="CMB-KUL-NRT" className="h-12 w-full text-white" />

            <Link
              href="/journeys/new"
              className="mt-auto inline-flex h-12 items-center justify-between gap-2 rounded-xl bg-white px-5 text-base font-medium text-coral-deep transition-colors hover:bg-sand-100"
            >
              Check a journey
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Flight by flight timeline */}
      <section aria-labelledby="timeline-heading" className="rounded-4xl bg-mist-soft px-5 py-10 sm:px-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/15 pb-6">
          <div className="space-y-3">
            <p className="eyebrow text-ink-soft">03 / Flight by flight</p>
            <h2 id="timeline-heading" className="display text-3xl sm:text-4xl text-ink">
              Where the trip <span className="accent text-coral-deep">comes apart.</span>
            </h2>
          </div>
          <p className="max-w-xs text-sm text-ink-soft">Sample trip. Times in UTC on 15 Sep 2026.</p>
        </div>

        <ol className="mt-2">
          {SAMPLE_TIMELINE.map((step, i) => (
            <li key={step.label} className="grid grid-cols-[72px_20px_1fr] sm:grid-cols-[140px_28px_1fr] gap-x-3 sm:gap-x-6">
              <div className="pt-6">
                <p className="display font-light text-3xl sm:text-5xl text-ink">{step.time}</p>
                <p className="eyebrow mt-2 text-ink-soft">{step.note}</p>
              </div>
              <div className="relative flex justify-center" aria-hidden="true">
                <span className={`absolute w-px bg-ink/30 ${i === 0 ? 'top-8' : 'top-0'} ${i === SAMPLE_TIMELINE.length - 1 ? 'h-8' : 'bottom-0'}`} />
                <span className="relative mt-7 h-3 w-3 rounded-full bg-coral" />
              </div>
              <div className={`py-6 ${i > 0 ? 'border-t border-ink/15' : ''} grid gap-3 md:grid-cols-[1fr_auto] md:items-start`}>
                <div className="space-y-1.5">
                  <p className="eyebrow text-ink-soft">{step.label}</p>
                  <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-ink">{step.title}</h3>
                  <p className="text-base text-ink-soft leading-relaxed max-w-xl">{step.body}</p>
                </div>
                <div>
                  <Badge status={step.status} label={step.statusLabel} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Next steps + overview */}
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="next-heading" className="space-y-6">
          <div className="space-y-3">
            <p className="eyebrow">04 / What you could do</p>
            <h2 id="next-heading" className="display text-3xl sm:text-4xl text-ink">
              Suggested <span className="accent text-coral">next steps.</span>
            </h2>
          </div>
          <ol className="divide-y divide-ink/10 border-y border-ink/10">
            {NEXT_STEPS.map((text, i) => (
              <li key={i} className="flex gap-5 py-5">
                <span className="display font-light text-3xl text-ink-muted w-10 shrink-0">0{i + 1}</span>
                <p className="text-base sm:text-lg text-ink leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-ink-muted leading-relaxed">
            SkyGuardian&apos;s risk level is a rule-based estimate from schedule data, not a probability. Always confirm
            changes with your airline before acting.
          </p>
        </section>

        <section aria-labelledby="overview-heading" className="surface p-6 sm:p-8 space-y-6 self-start">
          <div className="flex items-center justify-between gap-3">
            <h2 id="overview-heading" className="eyebrow">05 / Overview</h2>
            <Badge status="DEMO_DATA" label="Sample" />
          </div>
          <dl className="divide-y divide-ink/10">
            {SAMPLE_STATS.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-4 py-4">
                <dt>
                  <span className="block text-base text-ink">{s.label}</span>
                  <span className="block text-sm text-ink-muted">{s.note}</span>
                </dt>
                <dd className="display font-light text-5xl text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/history"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/15 bg-sand-50 px-5 text-sm font-medium text-ink transition-colors hover:border-ink/40"
          >
            See journey history
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  );
}
