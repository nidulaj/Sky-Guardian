import React from 'react';
import { ArrowRight } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { ConnectionSummary } from '@/types/journey';
import { ConnectionStatus } from '@/types/flight';
import { formatMinutes } from '@/lib/flightTime';

const STATUS_STYLES: Record<ConnectionStatus, { border: string; accent: string; bar: string }> = {
  SAFE: { border: 'border-ink/10', accent: 'text-status-safe', bar: 'bg-status-safe' },
  MODERATE_RISK: { border: 'border-status-caution/40', accent: 'text-status-caution', bar: 'bg-status-caution' },
  HIGH_RISK: { border: 'border-status-high/40', accent: 'text-status-high', bar: 'bg-status-high' },
  LIKELY_MISSED: { border: 'border-status-danger/40', accent: 'text-status-danger', bar: 'bg-status-danger' },
  MISSED: { border: 'border-status-danger/50', accent: 'text-status-danger', bar: 'bg-status-danger' },
  UNKNOWN: { border: 'border-dashed border-ink/25', accent: 'text-ink-muted', bar: 'bg-status-unknown' },
};

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  SAFE: 'Comfortable time to make this connection.',
  MODERATE_RISK: 'Connection is achievable, but the buffer is limited.',
  HIGH_RISK: 'Very tight connection. Move to the transfer desk quickly.',
  LIKELY_MISSED: 'Less time than the minimum connection time at this airport.',
  MISSED: 'The next flight leaves before you can make the transfer.',
  UNKNOWN: 'This connection could not be assessed with the available data.',
};

const REASON_TEXT: Record<string, string> = {
  INBOUND_FLIGHT_DELAYED: 'Inbound flight is delayed',
  OUTBOUND_FLIGHT_DELAYED: 'Next flight is delayed',
  INBOUND_FLIGHT_CANCELLED: 'Inbound flight is cancelled',
  OUTBOUND_FLIGHT_CANCELLED: 'Next flight is cancelled',
  INBOUND_FLIGHT_DIVERTED: 'Inbound flight is diverted',
  AIRPORT_MISMATCH: 'Flights do not connect at the same airport',
  MISSING_TIMING_DATA: 'Arrival or departure time is missing',
  INVALID_TIME_FORMAT: 'Flight times could not be read',
  NEGATIVE_CONNECTION_WINDOW: 'Next flight departs before arrival',
  BELOW_MINIMUM_CONNECTION_TIME: 'Below minimum connection time',
  TIGHT_TRANSFER_BUFFER: 'Less than 20 min spare',
  MODERATE_BUFFER: 'Less than 45 min spare',
  SUFFICIENT_TRANSFER_TIME: 'Sufficient transfer time',
  ARRIVAL_ESTIMATED_FROM_DELAY: 'Arrival estimated from reported delay',
  DEPARTURE_ESTIMATED_FROM_DELAY: 'Departure estimated from reported delay',
};

function statusText(status: ConnectionStatus, reasons: string[]): string {
  if (reasons.includes('INBOUND_FLIGHT_CANCELLED')) return 'Your inbound flight is cancelled, so this connection cannot be made.';
  if (reasons.includes('OUTBOUND_FLIGHT_CANCELLED')) return 'Your next flight is cancelled, so this connection cannot be made.';
  if (reasons.includes('INBOUND_FLIGHT_DIVERTED')) return 'Your inbound flight is diverted and may not reach this airport in time.';
  return STATUS_TEXT[status];
}

interface ConnectionCardProps {
  connection: ConnectionSummary;
  airport?: string | null;
  inboundFlight?: string | null;
  outboundFlight?: string | null;
}

function Stat({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 bg-sand-50 px-3 py-3 sm:px-4">
      <dt className="eyebrow">{label}</dt>
      <dd className={`display mt-2 text-2xl sm:text-4xl tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}

export default function ConnectionCard({ connection, airport, inboundFlight, outboundFlight }: ConnectionCardProps) {
  const status = (connection.status in STATUS_STYLES ? connection.status : 'UNKNOWN') as ConnectionStatus;
  const style = STATUS_STYLES[status];
  const known = status !== 'UNKNOWN' && !connection.reason_codes.some((c) => c.endsWith('_CANCELLED') || c === 'INBOUND_FLIGHT_DIVERTED');
  const available = connection.available_minutes;
  const required = connection.minimum_required_minutes;
  const short = connection.buffer_minutes < 0;

  // Bar scale: the MCT marker sits at 50% of the bar, so twice the MCT fills it
  const scale = Math.max(required * 2, 1);
  const fill = Math.min(Math.max(available / scale, 0), 1) * 100;

  return (
    <article className={`rounded-3xl border bg-sand-50 p-5 sm:p-6 ${style.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Connection</p>
          <h3 className="display mt-1 text-3xl text-ink">{airport ? `Transfer at ${airport}` : 'Your transfer'}</h3>
          {(inboundFlight || outboundFlight) && (
            <p className="mt-1 flex items-center gap-2 font-mono text-sm text-ink-soft">
              <span>{inboundFlight || '—'}</span>
              <ArrowRight className="h-3.5 w-3.5" aria-label="then" />
              <span>{outboundFlight || '—'}</span>
            </p>
          )}
        </div>
        <Badge status={status} />
      </div>

      <p className={`mt-4 text-base font-medium ${style.accent}`}>{statusText(status, connection.reason_codes)}</p>

      {known && (
        <>
          <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10">
            <Stat label="You have" value={formatMinutes(available)} tone={style.accent} />
            <Stat label="Minimum" value={formatMinutes(required)} />
            <Stat
              label={short ? 'Short by' : 'Spare'}
              value={formatMinutes(Math.abs(connection.buffer_minutes))}
              tone={short ? 'text-status-danger' : 'text-ink'}
            />
          </dl>

          <div className="mt-5 pb-6">
            <div
              className="relative h-2.5 rounded-full bg-sand-300"
              role="img"
              aria-label={`${available} minutes available, ${required} minutes required`}
            >
              <div className={`h-2.5 rounded-full ${style.bar}`} style={{ width: `${fill}%` }} />
              <div className="absolute -top-1.5 left-1/2 w-0.5 -translate-x-1/2 bg-ink" style={{ height: '1.375rem' }} aria-hidden="true" />
              <span className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm text-ink-muted" aria-hidden="true">
                Minimum {formatMinutes(required)}
              </span>
            </div>
          </div>
        </>
      )}

      {connection.reason_codes.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Reasons">
          {connection.reason_codes.map((code) => (
            <li key={code} className="rounded-full bg-sand-200 px-3 py-1 text-sm text-ink-soft">
              {REASON_TEXT[code] ?? code.replace(/_/g, ' ').toLowerCase()}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
