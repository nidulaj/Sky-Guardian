'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, HelpCircle, RotateCcw, Search, ShieldCheck, ShieldAlert, Lock } from 'lucide-react';
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
  const router = useRouter();
  const { user, isAdmin, isAuthenticated, isLoading: authLoading, token } = useAuth();

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
  const [searchingBackups, setSearchingBackups] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  const requestId = useRef(0);
  const analyzedJourney = useRef<{ legs: FlightLegInput[]; language: VoiceLanguage } | null>(null);
  const backupResultsRef = useRef<HTMLElement>(null);
  const focusBackups = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  const bringResultsIntoView = useCallback(() => {
    const el = resultsRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 64 || top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Redirect unauthenticated visitors to login immediately
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user)) {
      router.replace('/login?redirect=/dashboard');
    }
  }, [authLoading, isAuthenticated, user, router]);

  // Check for prefilled journey legs passed from History page "Check again"
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('skyguardian_recheck_legs');
      if (saved) {
        sessionStorage.removeItem('skyguardian_recheck_legs');
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLegs(parsed);
          window.setTimeout(() => {
            runCheck(parsed);
          }, 150);
        }
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }, []);

  // Once a result arrives, move focus to its heading so screen-reader and keyboard users land on it.
  useEffect(() => {
    if (!result) return;
    if (focusBackups.current) {
      focusBackups.current = false;
      backupResultsRef.current?.focus({ preventScroll: true });
      backupResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      resultHeadingRef.current?.focus({ preventScroll: true });
    }
  }, [result]);

  const runCheck = async (input: FlightLegInput[]) => {
    if (loading || searchingBackups) return;
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
    setBackupError(null);
    setResult(null);
    setDrawerOpen(false);
    setLoading(true);
    window.setTimeout(bringResultsIntoView, 50);

    const id = ++requestId.current;
    try {
      const res = await analyzeJourney(normalised, language, false, token);
      if (id === requestId.current) {
        analyzedJourney.current = { legs: normalised, language };
        setResult(res);

        // Save check optimistically to local cache for instant History tab availability
        if (user?.user_id) {
          try {
            const origin = normalised[0]?.origin || '';
            const destination = normalised[normalised.length - 1]?.destination || '';
            let via_airport: string | null = null;
            if (normalised.length === 2) {
              via_airport = normalised[0].destination || normalised[1].origin;
            } else if (normalised.length > 2) {
              via_airport = normalised.slice(0, -1).map((l) => l.destination).filter(Boolean).join(', ');
            }
            const places = via_airport ? `${origin} to ${destination} via ${via_airport}` : `${origin} to ${destination}, direct`;
            const flights_str = normalised.map((l) => l.flight_number).filter(Boolean).join(' · ');

            let status_code = 'ON_TIME';
            if (res.connection && ['LIKELY_MISSED', 'MISSED', 'HIGH_RISK', 'MODERATE_RISK'].includes(res.connection.status)) {
              status_code = res.connection.status;
            } else if (res.risk && ['VERY_HIGH', 'HIGH'].includes(res.risk.level)) {
              status_code = 'HIGH_RISK';
            } else if (res.risk && res.risk.level === 'MODERATE') {
              status_code = 'MODERATE_RISK';
            }

            const status_labels: Record<string, string> = {
              LIKELY_MISSED: 'Connection likely missed',
              MISSED: 'Connection missed',
              HIGH_RISK: 'High risk',
              MODERATE_RISK: 'Moderate risk',
              ON_TIME: 'Connection OK',
              SAFE: 'All clear',
              CANCELLED: 'Flight cancelled',
              DELAYED: 'Flight delayed',
            };
            const status_label = status_labels[status_code] || status_code.replace(/_/g, ' ');

            const outcome: 'attention' | 'clear' =
              ['LIKELY_MISSED', 'MISSED', 'HIGH_RISK', 'MODERATE_RISK', 'CANCELLED'].includes(status_code) ||
              (res.risk && ['HIGH', 'VERY_HIGH', 'MODERATE'].includes(res.risk.level))
                ? 'attention'
                : 'clear';

            const finding =
              res.primary_issue && res.primary_issue !== 'No critical disruption identified.'
                ? res.primary_issue
                : res.risk?.explanation?.[0] || 'All flights assessed with no critical disruption.';

            const next_step = res.recommendation || 'No action needed. Check again on the day of travel.';

            const historyItem = {
              id: res.journey_id || String(Date.now()),
              user_id: user.user_id,
              journey_id: res.journey_id,
              trace_id: res.trace_id,
              created_at: new Date().toISOString(),
              travel_date: normalised[0]?.travel_date || '',
              from_airport: origin,
              via_airport,
              to_airport: destination,
              places,
              flights: flights_str,
              status: status_code,
              status_label,
              outcome,
              finding,
              next_step,
              risk_score: res.risk?.score,
              risk_level: res.risk?.level,
              legs: normalised,
              analysis_data: {
                journey_status: res.journey_status,
                primary_issue: res.primary_issue,
                recommendation: res.recommendation,
              },
            };

            const storageKey = `skyguardian_journey_history_${user.user_id}`;
            const existingStr = localStorage.getItem(storageKey);
            const existing = existingStr ? JSON.parse(existingStr) : [];
            const updated = [
              historyItem,
              ...existing.filter((item: any) => item.journey_id !== res.journey_id && item.id !== historyItem.id),
            ].slice(0, 50);
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch (storageErr) {
            console.warn('Could not cache check to localStorage:', storageErr);
          }
        }
      }
    } catch (err: any) {
      if (id === requestId.current) {
        setError(err instanceof Error && err.message ? err.message : 'Something went wrong while checking this journey.');
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  const findBackups = async () => {
    const checked = analyzedJourney.current;
    if (!checked || loading || searchingBackups) return;
    setSearchingBackups(true);
    setBackupError(null);
    const id = ++requestId.current;
    try {
      const res = await analyzeJourney(checked.legs, checked.language, true);
      if (id === requestId.current) {
        focusBackups.current = true;
        setResult(res);
      }
    } catch {
      if (id === requestId.current) setBackupError('Backup search failed. Try again or ask the airline for options.');
    } finally {
      if (id === requestId.current) setSearchingBackups(false);
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

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-sand-100 border border-ink/10 shadow-sm">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-coral border-r-transparent" />
        </div>
        <div className="space-y-1">
          <p className="eyebrow text-ink-muted">Security Verification</p>
          <p className="text-sm font-medium text-ink">Verifying passenger credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="relative mx-auto my-8 sm:my-14 max-w-xl overflow-hidden rounded-3xl border border-ink/15 bg-sand-50/95 p-8 sm:p-12 text-center shadow-[0_25px_60px_-15px_rgba(26,23,20,0.15)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-status-caution/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-coral/10 blur-3xl" />

        <div className="relative space-y-6">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-status-caution-bg border border-status-caution/30 text-status-caution shadow-inner">
            <ShieldAlert className="h-8 w-8 stroke-[2.2]" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-caution opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-status-caution" />
            </span>
          </div>

          <div className="space-y-2">
            <span className="font-mono text-[10px] tracking-widest uppercase font-bold text-status-caution">
              Restricted Area · Authentication Required
            </span>
            <h1 className="font-sans font-semibold text-2xl sm:text-3xl text-ink leading-tight">
              Passenger Sign-In Required
            </h1>
            <p className="text-sm text-ink-soft max-w-md mx-auto leading-relaxed">
              You must be signed in with a registered passenger account to access real-time journey risk analysis, flight tracking, and disruption compensation engines.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/login?redirect=/dashboard"
              className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-sand-50 transition-colors hover:bg-ink-soft shadow-md shadow-ink/10"
            >
              <span>Sign in as Passenger</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-ink/20 px-6 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-sand-100"
            >
              Create Passenger Account
            </Link>
          </div>

          <div className="pt-2 border-t border-ink/10 flex items-center justify-center gap-2 text-xs font-mono text-ink-muted">
            <Lock className="h-3 w-3 text-ink-muted" />
            <span>Protected by SkyGuardian Security Clearance Protocol</span>
          </div>
        </div>
      </div>
    );
  }

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
              loading={loading || searchingBackups}
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
                    ['Press Check my journey', 'Flight status, transfer time and weather are checked.'],
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
                        Confirm flight changes and rebooking with your airline.
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
                <section ref={backupResultsRef} tabIndex={-1} aria-labelledby="backup-routes-title" className="space-y-6">
                  <SectionTitle n={6} label="Backup flights" id="backup-routes-title" />
                  <Button type="button" variant="outline" className="max-w-full rounded-md"
                    isLoading={searchingBackups} loadingText="Searching..." onClick={() => void findBackups()}>
                    <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Find backup flights
                  </Button>
                  {backupError && <p role="alert" className="text-sm text-status-danger">{backupError}</p>}
                  {searchingBackups
                    ? <p role="status" className="text-sm text-ink-soft">Checking backup flights...</p>
                    : <AlternativesList items={result.alternatives} search={result.alternative_search} />}
                </section>

                {/* 07 Policy */}
                <section className="space-y-6">
                  <SectionTitle n={7} label="Airline rules" />
                  <PolicyEvidenceList items={result.policy_evidence} />
                </section>

                {/* 08 Sources */}
                <section className="space-y-6">
                  <SectionTitle n={8} label="Sources" />
                  <SourcesList items={result.sources} />
                  <div className="flex flex-col gap-1 font-mono text-sm text-ink-muted sm:flex-row sm:flex-wrap sm:gap-x-6">
                    {updated && <span>Last updated {updated}</span>}
                  </div>
                  <Button variant="ghost" onClick={() => setDrawerOpen(true)} className="-ml-3">
                    View check details
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </section>
              </article>
            )}
          </div>
        </div>
      </section>

      <VoiceJourneyPanel language={language} onLanguageChange={setLanguage} analysis={result} disabled={loading || searchingBackups}
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
        workflowTrace={result?.workflow_trace ?? []}
        recoveryReasons={result?.recovery_reasons ?? []}
      />
    </div>
  );
}
