'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, HelpCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { analyzeJourney } from '@/lib/api/client';
import type { FlightLegInput, JourneyAnalysisResponse } from '@/types/journey';
import type { FlightResult } from '@/types/flight';
import { formatDateTimeUtc } from '@/lib/flightTime';
import PageHeader from '@/components/ui/PageHeader';
import Badge, { statusLabel } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import BoardingPassForm, { DEFAULT_TRAVEL_DATE, fieldId } from '@/components/journey/BoardingPassForm';
import { LegErrors, LegField, countErrors, normaliseFlightNumber, validateLegs } from '@/components/journey/validation';
import RouteStrip from '@/components/journey/RouteStrip';
import RiskRadarMeter from '@/components/journey/RiskRadarMeter';
import AgentWorkflowProgress from '@/components/journey/AgentWorkflowProgress';
import ExplainabilityDrawer from '@/components/journey/ExplainabilityDrawer';
import FlightStatusCard from '@/components/journey/FlightStatusCard';
import ConnectionCard from '@/components/journey/ConnectionCard';
import SafeRichText from '@/components/journey/SafeRichText';
import { AlternativesList, PolicyEvidenceList, SourcesList } from '@/components/journey/JourneyDetails';
import JourneyWeatherPanel from '@/components/journey/JourneyWeatherPanel';
import PassengerPolicyAssistant from '@/components/dashboard/PassengerPolicyAssistant';
import VoiceJourneyPanel from '@/components/voice/VoiceJourneyPanel';
import type { VoiceLanguage } from '@/types/voice';

// Transfer airport label, matching ConnectionResult.airport in the Connection Agent
function connectionAirport(flights: FlightResult[]): string | undefined {
  const arrivesAt = flights[0]?.destination;
  const departsFrom = flights[1]?.origin;
  if (arrivesAt && departsFrom && arrivesAt !== departsFrom) return `${arrivesAt}/${departsFrom}`;
  return arrivesAt || departsFrom || undefined;
}

const FIELD_ORDER: LegField[] = ['origin', 'destination', 'flight_number', 'travel_date'];

function SectionTitle({ n, label, id }: { n: number; label: string; id?: string }) {
  return (
    <h2 id={id} className="eyebrow flex items-center gap-3">
      <span>
        {String(n).padStart(2, '0')} / {label}
      </span>
      <span className="h-px flex-1 bg-ink/15" aria-hidden="true" />
    </h2>
  );
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();

  const [legs, setLegs] = useState<FlightLegInput[]>(() =>
    Array.from({ length: 2 }, () => ({ flight_number: '', origin: '', destination: '', travel_date: DEFAULT_TRAVEL_DATE })),
  );
  const [errors, setErrors] = useState<LegErrors[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JourneyAnalysisResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [language, setLanguage] = useState<VoiceLanguage>('en');

  const requestId = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  const bringResultsIntoView = useCallback(() => {
    const el = resultsRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 64 || top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Once a result arrives, move focus to its heading so screen-reader and keyboard users land on it.
  useEffect(() => {
    if (result) resultHeadingRef.current?.focus({ preventScroll: true });
  }, [result]);

  const runCheck = async (input: FlightLegInput[]) => {
    const normalised = input.map((l) => ({ ...l, flight_number: normaliseFlightNumber(l.flight_number) }));
    setLegs(normalised);

    const found = validateLegs(normalised);
    const count = countErrors(found);
    if (count > 0) {
      setErrors(found);
      setFormError(`Please fix ${count === 1 ? 'the highlighted detail' : `the ${count} highlighted details`} before checking.`);
      const i = found.findIndex((e) => Object.keys(e).length > 0);
      const field = FIELD_ORDER.find((f) => found[i][f]);
      if (field) window.setTimeout(() => document.getElementById(fieldId(i, field))?.focus(), 0);
      return;
    }

    setErrors([]);
    setFormError(null);
    setError(null);
    setResult(null);
    setDrawerOpen(false);
    setLoading(true);
    window.setTimeout(bringResultsIntoView, 50);

    const id = ++requestId.current;
    try {
      const res = await analyzeJourney(normalised, language);
      if (id === requestId.current) setResult(res);
    } catch (err: any) {
      if (id === requestId.current) {
        setError(err instanceof Error && err.message ? err.message : 'Something went wrong while checking this journey.');
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void runCheck(legs);
  };

  const handleLegsChange = (next: FlightLegInput[]) => {
    setLegs(next);
    // Clear an error as soon as the person edits that field.
    if (errors.length) {
      const cleared = errors
        .slice(0, next.length)
        .map((legErrors, i) =>
          Object.fromEntries(Object.entries(legErrors).filter(([f]) => next[i][f as LegField] === legs[i]?.[f as LegField])),
        ) as LegErrors[];
      setErrors(cleared);
      if (countErrors(cleared) === 0) setFormError(null);
    }
  };

  const flights = result?.flight_statuses ?? [];
  const airport = connectionAirport(flights);
  const updated = formatDateTimeUtc(result?.last_updated);

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Personalized Header */}
      <PageHeader
        eyebrow={user?.first_name ? `Passenger Portal · Welcome back, ${user.first_name}` : 'Passenger Dashboard · Connection Risk'}
        title="Will you make your"
        accent="connection?"
        description="Enter each flight in your trip. SkyGuardian checks flight status, transfer time, and airport weather, then explains what to do if something goes wrong."
        actions={
          isAdmin ? (
            <Link
              href="/admin"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-coral bg-coral-peach/15 px-6 text-base font-medium text-coral-deep transition-colors hover:bg-coral hover:text-white"
            >
              <ShieldCheck className="h-4 w-4" />
              Open Admin Vault
            </Link>
          ) : undefined
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

      {/* Interactive Journey Check Section (The /journeys/new UI) */}
      <section aria-label="Journey check" className="space-y-8">

        {/* 2-Column Boarding Pass Form + Real-time Results */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8 xl:gap-12">
          {/* Left: Input Form */}
          <div className="lg:col-span-5">
            <BoardingPassForm
              legs={legs}
              errors={errors}
              formError={formError}
              loading={loading}
              onChange={handleLegsChange}
              onSubmit={handleSubmit}
            />
          </div>

          {/* Right: Results or Loading */}
          <div ref={resultsRef} className="min-w-0 scroll-mt-24 lg:col-span-7 sm:scroll-mt-28">
            {error && (
              <div role="alert" className="mb-6 rounded-3xl border border-status-danger/30 bg-status-danger-bg p-5 sm:p-6">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-status-danger" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-ink">We couldn’t check this journey</p>
                    <p className="mt-1 text-base text-ink-soft">{error}</p>
                    <Button variant="secondary" className="mt-4" onClick={() => void runCheck(legs)}>
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Try again
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {loading && <AgentWorkflowProgress />}

            {!result && !loading && !error && (
              <div className="rounded-4xl border border-dashed border-ink/20 px-6 py-10 sm:px-10 sm:py-14">
                <p className="eyebrow">Results</p>
                <p className="display mt-4 text-3xl sm:text-4xl text-ink">
                  Your check will <span className="accent text-coral">appear here.</span>
                </p>
                <ol className="mt-8 space-y-0">
                  {[
                    ['Enter each flight', 'Airport codes, flight number and date for every leg of the trip.'],
                    ['Press Check my journey', 'Seven agents look at flights, transfer time, weather and airline rules.'],
                    ['Read the result', 'A risk estimate, clear advice, backup routes and the sources behind them.'],
                  ].map(([title, desc], i) => (
                    <li key={title} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 border-t border-ink/10 py-4">
                      <span className="display text-3xl font-light text-ink-muted" aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span>
                        <span className="block text-lg font-semibold text-ink">{title}</span>
                        <span className="mt-0.5 block text-base text-ink-soft">{desc}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {result && !loading && (
              <article aria-labelledby="result-title" className="space-y-12">
                {/* 01 Summary */}
                <section className="space-y-6">
                  <SectionTitle n={1} label="What we found" />
                  <div className="flex flex-wrap items-center gap-2">
                    {result.is_demo_data && <Badge status="DEMO_DATA" label="Includes demo data" />}
                    <Badge status={result.journey_status} label={statusLabel(result.journey_status)} />
                  </div>
                  <h3 id="result-title" ref={resultHeadingRef} tabIndex={-1} className="display text-4xl sm:text-5xl text-ink focus:outline-none">
                    {result.primary_issue}
                  </h3>
                  {result.is_demo_data && (
                    <p className="text-base text-ink-soft">
                      This assessment includes demo data. Check the source label on each flight and weather result before relying on it.
                    </p>
                  )}

                  <div className="surface p-5 sm:p-7">
                    <RouteStrip flights={flights} connection={result.connection} />
                  </div>

                  {result.warnings.length > 0 && (
                    <div className="rounded-3xl border border-status-caution/25 bg-status-caution-bg/60 p-5 sm:p-6">
                      <p className="eyebrow text-ink-soft">Please note</p>
                      <ul className="mt-3 space-y-2">
                        {result.warnings.map((w, i) => (
                          <li key={i} className="flex gap-2.5 text-base text-ink">
                            <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-status-caution" aria-hidden="true" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>

                {/* 02 Risk */}
                <section className="space-y-6">
                  <SectionTitle n={2} label="Risk estimate" />
                  <RiskRadarMeter risk={result.risk} />
                </section>

                {/* 03 Recommendation */}
                <section className="space-y-6">
                  <SectionTitle n={3} label="What to do now" />
                  <div className="rounded-3xl border border-ink/10 bg-sand-50 p-5 sm:p-8">
                    <SafeRichText text={result.recommendation} className="text-base sm:text-lg text-ink-soft leading-relaxed" />
                    <div className="mt-6 flex flex-col gap-4 border-t border-ink/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-ink-muted">
                        Written by the Recovery agent. Check it against the details below and confirm with your airline before you act.
                      </p>
                      <Button variant="outline" onClick={() => setDrawerOpen(true)} className="shrink-0">
                        <HelpCircle className="h-4 w-4" aria-hidden="true" />
                        Why this advice?
                      </Button>
                    </div>
                  </div>
                </section>

                {/* 04 Flights + connection */}
                <section className="space-y-6">
                  <SectionTitle n={4} label={flights.length === 1 ? 'Your flight' : 'Your flights'} />
                  {flights.length > 0 ? (
                    <div className="grid gap-4">
                      {flights.map((flight, idx) => (
                        <FlightStatusCard key={`${flight.flight_number}-${idx}`} flight={flight} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-base text-ink-soft">No flight status was returned.</p>
                  )}
                  {result.connection && (
                    <ConnectionCard
                      connection={result.connection}
                      airport={airport}
                      inboundFlight={flights[0]?.flight_number}
                      outboundFlight={flights[1]?.flight_number}
                    />
                  )}
                </section>

                {/* 05 Weather */}
                <section className="space-y-6">
                  <SectionTitle n={5} label="Airport weather" />
                  <JourneyWeatherPanel weather={result.weather_conditions} />
                </section>

                {/* 06 Alternatives */}
                <section className="space-y-6">
                  <SectionTitle n={6} label="Backup routes, ranked" />
                  <AlternativesList items={result.alternatives} search={result.alternative_search} />
                </section>

                {/* 07 Policy */}
                <section className="space-y-6">
                  <SectionTitle n={7} label="Airline policy evidence" />
                  <PolicyEvidenceList items={result.policy_evidence} />
                </section>

                {/* 08 Sources */}
                <section className="space-y-6">
                  <SectionTitle n={8} label="Sources" />
                  <SourcesList items={result.sources} />
                  <div className="flex flex-col gap-1 font-mono text-sm text-ink-muted sm:flex-row sm:flex-wrap sm:gap-x-6">
                    {updated && <span>Last updated {updated}</span>}
                    <span className="break-all">Trace {result.trace_id}</span>
                  </div>
                  <Button variant="ghost" onClick={() => setDrawerOpen(true)} className="-ml-3">
                    See how this result was built
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </section>
              </article>
            )}
          </div>
        </div>
      </section>

      <VoiceJourneyPanel language={language} onLanguageChange={setLanguage} analysis={result} disabled={loading}
        onDraft={(draftLegs) => {
          setLegs(draftLegs);
          setErrors([]);
          setFormError(null);
          setResult(null);
          setError(null);
        }} />

      {/* Passenger RAG Policy Assistant Widget */}
      <section className="border-t border-ink/10 pt-10">
        <PassengerPolicyAssistant />
      </section>

      {/* Explainability Drawer */}
      <ExplainabilityDrawer
        isOpen={drawerOpen && !!result}
        onClose={() => setDrawerOpen(false)}
        risk={result?.risk}
        primaryIssue={result?.primary_issue}
        flights={flights}
        connection={result?.connection}
        connectionAirport={airport}
        sources={result?.sources ?? []}
        traceId={result?.trace_id}
      />
    </div>
  );
}
