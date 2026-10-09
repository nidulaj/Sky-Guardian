import React from 'react';
import { AlertTriangle, ArrowRight, ArrowUpRight, ChevronDown, CloudSun, Quote } from 'lucide-react';
import Badge, { statusLabel } from '@/components/ui/Badge';
import type { AlternativeOption, AlternativeSearchSummary, PolicyEvidence, SourceRef, WeatherCondition } from '@/types/journey';
import { formatFlightTime, formatLocalTime, formatMinutes, formatTravelDate } from '@/lib/flightTime';

function TimeText({ iso }: { iso?: string | null }) {
  const t = formatFlightTime(iso);
  if (!t) return <span className="text-ink-muted">Not given</span>;
  return (
    <>
      <span className="font-semibold text-ink tabular-nums">{t.time}</span>{' '}
      <span className="text-ink-muted">UTC · {t.date}</span>
    </>
  );
}

/* ---------- Weather ---------- */

export function WeatherList({ items }: { items: WeatherCondition[] }) {
  if (items.length === 0) return <p className="text-base text-ink-soft">No weather information was returned for this route.</p>;
  return (
    <ul className="divide-y divide-ink/10 border-y border-ink/10">
      {items.map((w, i) => {
        const severity = (w.severity || 'UNKNOWN').toUpperCase();
        return (
          <li key={`${w.airport}-${i}`} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 py-4 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:items-start">
            <span className="display text-3xl text-ink">{w.airport}</span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-base text-ink">
                <CloudSun className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                {w.condition || 'Conditions not reported'}
              </p>
              {(w.warnings ?? []).map((warning, wi) => (
                <p key={wi} className="mt-1.5 flex gap-2 text-sm text-status-caution">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {warning}
                </p>
              ))}
            </div>
            <div className="col-start-2 mt-2 sm:col-start-auto sm:mt-0">
              <Badge status={severity} label={`${statusLabel(severity)} impact`} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Alternatives ---------- */

function RouteTime({ iso, timeZone }: { iso?: string | null; timeZone?: string | null }) {
  const time = formatLocalTime(iso, timeZone);
  if (!time) return <span className="text-sm text-ink-muted">Time unconfirmed</span>;
  return <>
    <span className="block text-2xl font-semibold tabular-nums text-ink">{time.time}</span>
    <span className="mt-1 block text-xs text-ink-muted">{time.date} · {time.zone}</span>
  </>;
}

function confirmedDetail(value?: string | null): string {
  return !value?.trim() || value.trim().toUpperCase() === 'UNKNOWN' ? 'Not confirmed' : value;
}

export function AlternativesList({ items, search }: { items: AlternativeOption[]; search?: AlternativeSearchSummary }) {
  const sorted = [...items].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const emptyMessage = search?.status === 'unavailable'
    ? 'Routes could not be checked. Ask the airline transfer desk for options.'
    : search?.status === 'no_results'
      ? 'No suitable route found in this search. Ask the airline for other options.'
      : search?.status === 'not_needed'
        ? 'No backup route needed for this journey.'
        : 'No backup routes available. Ask the airline for options.';
  return (
    <div className="min-w-0" data-testid="journey-alternatives">
      {sorted.length > 0 && <div className="mb-4 text-sm text-ink-soft">
        <p className="font-medium text-ink">Ask your airline to confirm seats, price and rebooking.</p>
        {search?.origin && <p className="mt-1">Starting from <strong className="text-ink">{search.origin}</strong>. Confirm you can reach this airport.</p>}
      </div>}
      {sorted.length === 0 && <p role="status" className="border-l-2 border-coral py-2 pl-4 text-base text-ink-soft">{emptyMessage}</p>}
    <ol className="space-y-3">
      {sorted.map((alt, i) => {
        const top = i === 0;
        const firstLeg = alt.legs?.[0];
        const lastLeg = alt.legs?.[alt.legs.length - 1];
        const airports = firstLeg ? [firstLeg.origin, ...alt.legs!.map((leg) => leg.destination)] : [];
        const limitedRisk = !alt.risk_confidence || ['low', 'unknown'].includes(alt.risk_confidence) || !alt.risk_level || alt.risk_level === 'UNKNOWN';
        const risky = ['HIGH', 'VERY_HIGH'].includes(alt.risk_level ?? '');
        return (
          <li
            key={alt.option_id ?? i}
            className={`min-w-0 rounded-lg border p-4 sm:p-5 ${
              top ? 'border-coral/60 bg-sand-50' : 'border-ink/15 bg-sand-50'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`font-semibold ${top ? 'text-coral' : 'text-ink-muted'}`}>{top ? 'Top match' : `Option ${alt.rank ?? i + 1}`}</span>
              {alt.data_mode === 'demo' && <Badge status="DEMO_DATA" label="Sample only" />}
              {alt.data_mode === 'timetable' && <span className="text-ink-muted">Schedule only</span>}
              {(limitedRisk || risky) && <span className="inline-flex items-center gap-1 text-status-caution"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{risky ? 'Higher disruption risk' : 'Limited risk data'}</span>}
            </div>
            <h4 className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold leading-snug text-ink">
              {airports.length ? airports.map((airport, index) => <React.Fragment key={`${airport}-${index}`}>
                {index > 0 && <><ArrowRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" /><span className="sr-only">to</span></>}
                <span>{airport}</span>
              </React.Fragment>) : alt.route_summary.replace(/\s*->\s*/g, ' → ')}
            </h4>
            <p className="mt-1 break-words text-sm text-ink-soft">
              {alt.duration_minutes != null && <>{formatMinutes(alt.duration_minutes)} · </>}
              {alt.connections == null ? 'Stops unconfirmed' : alt.connections === 0 ? 'Direct' : `${alt.connections} stop${alt.connections > 1 ? 's' : ''}`}
              {alt.legs?.length ? ` · ${alt.legs.map((leg) => leg.flight_number).join(' / ')}` : ''}
            </p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <dt className="text-xs text-ink-muted">Leaves{firstLeg ? ` ${firstLeg.origin}` : ''}</dt>
                  <dd className="mt-1"><RouteTime iso={alt.departure} timeZone={firstLeg?.origin_timezone} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Arrives{lastLeg ? ` ${lastLeg.destination}` : ''}</dt>
                  <dd className="mt-1"><RouteTime iso={alt.arrival} timeZone={lastLeg?.destination_timezone} /></dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-status-caution">{alt.data_mode === 'demo' ? 'Sample flight. Not bookable.' : 'Seats & price unconfirmed.'}</p>
              {(alt.connections ?? 0) > 0 && <p className="mt-1 text-xs text-ink-muted">Confirm transfer, baggage and entry rules.</p>}
              <details className="group mt-3 border-t border-ink/10 text-sm text-ink-soft">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-medium text-ink [&::-webkit-details-marker]:hidden">
                  Flight details <span className="sr-only">for option {alt.rank ?? i + 1}</span><ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                {alt.legs?.map((flight, index) => <div key={`${flight.flight_number}-${index}`} className="mb-3 border-b border-ink/10 pb-3">
                  <p className="font-medium text-ink">{flight.flight_number} · {flight.origin} → {flight.destination}</p>
                  <p className="mt-1">{flight.airline || 'Airline unconfirmed'}</p>
                  <p className="mt-1">Departs <TimeText iso={flight.estimated_departure || flight.scheduled_departure} /></p>
                  <p className="mt-1">Arrives <TimeText iso={flight.estimated_arrival || flight.scheduled_arrival} /></p>
                </div>)}
                <p>Price: {confirmedDetail(alt.price)}</p>
                <p className="mt-1">Seats: {confirmedDetail(alt.availability_status)}</p>
                <p className="mt-1">Rebooking: {confirmedDetail(alt.policy_eligibility)}</p>
                {(alt.ranking_reasons ?? []).length > 0 && <ul className="mt-3 list-disc space-y-1 pl-4">{alt.ranking_reasons!.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
                {(alt.warnings ?? []).length > 0 && <ul className="mt-3 space-y-2">{alt.warnings!.map((warning, index) => <li key={index} className="flex gap-2 text-status-caution"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{warning}</span></li>)}</ul>}
                {alt.sources?.map((source, si) => <p key={si} className="mt-2 break-words text-xs text-ink-muted">Source: {source.name}</p>)}
                {alt.retrieved_at && <p className="mt-1 pb-3 text-xs text-ink-muted">Checked: <TimeText iso={alt.retrieved_at} /></p>}
              </details>
          </li>
        );
      })}
    </ol>
      {search && search.status !== 'not_needed' && <details className="mt-4 border-t border-ink/15 text-sm text-ink-soft">
        <summary className="min-h-11 cursor-pointer py-3 font-medium text-ink">About this search</summary>
        {search.earliest_departure && <p className="mb-2">Earliest departure: <TimeText iso={search.earliest_departure} /></p>}
        {search.status === 'partial' && <p className="mb-2">Limited search. Other routes may exist.</p>}
        {(search.warnings ?? []).map((warning) => <p key={warning} className="mb-2 break-words">{warning}</p>)}
      </details>}
    </div>
  );
}

/* ---------- Policy evidence ---------- */

function safeHttpUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function PolicyEvidenceList({ items }: { items: PolicyEvidence[] }) {
  if (items.length === 0) return <p className="text-base text-ink-soft">No airline rules found. Check with your airline.</p>;
  return (
    <ul className="grid gap-4">
      {items.map((p, i) => {
        const href = safeHttpUrl(p.source_url);
        const effective = formatTravelDate(p.effective_date);
        return (
          // id matches the recovery plan's citation P1..Pn (position in the evidence list).
          <li key={p.policy_id ?? i} id={`policy-P${i + 1}`} className="scroll-mt-24 rounded-3xl border border-ink/10 bg-sand-50 p-5 sm:p-6">
            <p className="eyebrow">
              <span className="font-mono">[P{i + 1}]</span> {[p.airline, p.policy_type].filter(Boolean).join(' / ') || 'Airline policy'}
            </p>
            {p.title && <h4 className="mt-2 text-lg font-semibold text-ink leading-snug">{p.title}</h4>}
            {p.snippet && (
              <blockquote className="mt-4 flex gap-3 border-l-2 border-coral pl-4">
                <Quote className="mt-1 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                <p className="font-serif text-xl italic leading-snug text-ink">{p.snippet}</p>
              </blockquote>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">{effective ? `Effective ${effective}` : 'Effective date not given'}</p>
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink underline decoration-coral underline-offset-4 hover:decoration-2"
                >
                  Read the airline’s policy
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Sources ---------- */

export function SourcesList({ items }: { items: SourceRef[] }) {
  if (items.length === 0) return <p className="text-base text-ink-soft">No sources were listed.</p>;
  return (
    <ul className="divide-y divide-ink/10 border-y border-ink/10">
      {items.map((s, i) => {
        const href = safeHttpUrl(s.url);
        return (
          <li key={`${s.name}-${i}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
            <span className="min-w-0 text-base text-ink">
              {href ? (
                <a href={href} target="_blank" rel="noreferrer" className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
                  {s.name}
                </a>
              ) : (
                s.name
              )}
            </span>
            <span className="flex items-center gap-2 text-sm text-ink-muted">
              {s.type}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
