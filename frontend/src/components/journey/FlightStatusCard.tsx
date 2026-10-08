import React from 'react';
import { Plane, Info } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { FlightResult } from '@/types/flight';
import { formatFlightTime, formatLocalTime, formatMinutes } from '@/lib/flightTime';

const REASON_TEXT: Record<string, string> = {
  FLIGHT_NOT_FOUND: 'No status data found for this flight number on this date.',
  FLIGHT_DATA_UNAVAILABLE: 'Live flight status is temporarily unavailable.',
  PROVIDER_ERROR: 'Flight status could not be retrieved.',
  INVALID_FLIGHT_NUMBER: 'Flight number not recognised. Use the format UL001.',
  INVALID_AIRPORT_CODE: 'Airport codes must be 3 letters, e.g. CMB.',
  INVALID_TRAVEL_DATE: 'Travel date must be in YYYY-MM-DD format.',
  ROUTE_MISMATCH: 'This flight operates a different route than the one entered.',
  DELAY_DERIVED_FROM_TIMES: 'Delay calculated from the published timetable.',
  INVALID_TIMESTAMP: 'Some times from the data source were unreadable and were ignored.',
  UNKNOWN_AIRPORT: 'One of these airport codes does not exist. Pick the airport from the suggestions.',
  DATE_NOT_COVERED: 'Flight data is not available for this date (past flights are not covered).',
  TIMETABLE_ONLY: 'Times from the published timetable. Live delays and gates appear about a day before departure.',
  TIMEZONE_UNVERIFIED: 'Some times could not be converted to local time and are shown as reported.',
  INCIDENT_REPORTED: 'The data source reports an incident for this flight. Check with your airline.',
};

const DATA_MODE: Record<string, { status: string; label: string }> = {
  live: { status: 'VERIFIED', label: 'Live status' },
  timetable: { status: 'SCHEDULED', label: 'Published timetable' },
  demo: { status: 'DEMO_DATA', label: 'Demo data' },
};

function TimeCell({ label, iso, timeZone, city, highlight }: {
  label: string; iso?: string | null; timeZone?: string | null; city?: string | null; highlight?: boolean;
}) {
  const t = formatLocalTime(iso, timeZone);
  return (
    <div className="min-w-0 bg-sand-50 px-3 py-3 sm:px-4">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1.5">
        {t ? (
          <>
            <span className={`block text-xl font-semibold tabular-nums ${highlight ? 'text-status-caution' : 'text-ink'}`}>{t.time}</span>
            <span className="block text-sm text-ink-muted" title={t.isLocal ? `${t.zone} (${timeZone})` : 'Coordinated Universal Time'}>
              {t.isLocal ? `${city || 'Local'} time` : 'UTC'} · {t.date}
            </span>
          </>
        ) : (
          <span className="block text-xl font-semibold text-ink-muted">
            —<span className="sr-only">not available</span>
          </span>
        )}
      </dd>
    </div>
  );
}

export default function FlightStatusCard({ flight }: { flight: FlightResult }) {
  const expectedDeparture = flight.actual_departure || flight.estimated_departure;
  const expectedArrival = flight.actual_arrival || flight.estimated_arrival;
  const isDelayed = flight.delay_minutes > 0;
  const reasons = (flight.reason_codes ?? []).filter((code) => REASON_TEXT[code]);
  const retrieved = formatFlightTime(flight.retrieved_at);
  const status = flight.status || 'UNKNOWN';
  const alarming = status === 'CANCELLED' || status === 'DIVERTED';

  return (
    <article
      className={`rounded-3xl border bg-sand-50 p-5 sm:p-6 ${
        alarming ? 'border-status-danger/40' : status === 'UNKNOWN' ? 'border-dashed border-ink/25' : 'border-ink/10'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Flight</p>
          <h3 className="display mt-1 text-3xl text-ink">{flight.flight_number || '—'}</h3>
          {flight.airline && <p className="mt-1 text-sm text-ink-soft">{flight.airline}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge status={status} />
          {flight.data_mode && DATA_MODE[flight.data_mode] && (
            <Badge status={DATA_MODE[flight.data_mode].status} label={DATA_MODE[flight.data_mode].label} />
          )}
          {isDelayed && <span className="text-sm font-medium text-status-caution">{formatMinutes(flight.delay_minutes)} late</span>}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3" aria-label={`From ${flight.origin || 'unknown'} to ${flight.destination || 'unknown'}`}>
        <span className="min-w-0">
          <span className="display block text-4xl sm:text-5xl text-ink">{flight.origin || '—'}</span>
          {flight.origin_city && <span className="mt-1 block truncate text-sm text-ink-muted">{flight.origin_city}</span>}
        </span>
        <span className="flex items-center gap-1.5 text-coral" aria-hidden="true">
          <span className="flex-1 border-t border-dashed border-ink/30" />
          <Plane className="h-4 w-4 fill-current" />
          <span className="flex-1 border-t border-dashed border-ink/30" />
        </span>
        <span className="min-w-0 text-right">
          <span className="display block text-4xl sm:text-5xl text-ink">{flight.destination || '—'}</span>
          {flight.destination_city && <span className="mt-1 block truncate text-sm text-ink-muted">{flight.destination_city}</span>}
        </span>
      </div>

      {status !== 'UNKNOWN' && (
        <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10">
          <TimeCell label="Sched. dep." iso={flight.scheduled_departure} timeZone={flight.origin_timezone} city={flight.origin_city} />
          <TimeCell label={flight.actual_departure ? 'Actual dep.' : 'Expected dep.'} iso={expectedDeparture} timeZone={flight.origin_timezone} city={flight.origin_city} highlight={isDelayed} />
          <TimeCell label="Sched. arr." iso={flight.scheduled_arrival} timeZone={flight.destination_timezone} city={flight.destination_city} />
          <TimeCell label={flight.actual_arrival ? 'Actual arr.' : 'Expected arr.'} iso={expectedArrival} timeZone={flight.destination_timezone} city={flight.destination_city} highlight={isDelayed} />
        </dl>
      )}

      {reasons.length > 0 && (
        <ul className="mt-4 space-y-2">
          {reasons.map((code) => (
            <li key={code} className="flex items-start gap-2 text-sm text-ink-soft">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <span>{REASON_TEXT[code]}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-ink-muted">
        <span>
          {flight.terminal ? `Terminal ${flight.terminal}` : ''}
          {flight.terminal && flight.gate ? ' · ' : ''}
          {flight.gate ? `Gate ${flight.gate}` : ''}
        </span>
        <span>
          Source: {flight.source}
          {retrieved ? ` · ${retrieved.time} UTC` : ''}
        </span>
      </div>
    </article>
  );
}
