import React from 'react';
import { Plane } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import type { FlightResult } from '@/types/flight';
import type { ConnectionSummary } from '@/types/journey';
import { formatMinutes } from '@/lib/flightTime';

interface RouteStripProps {
  flights: FlightResult[];
  /** The API currently returns only the first connection, so it is shown at the first transfer stop. */
  connection?: ConnectionSummary | null;
}

function lineTone(status: string) {
  if (status === 'CANCELLED' || status === 'DIVERTED') return 'border-status-danger';
  if (status === 'DELAYED') return 'border-status-caution';
  if (status === 'UNKNOWN') return 'border-ink/25';
  return 'border-ink/40';
}

interface Stop {
  code: string;
  caption: string;
}

function buildStops(flights: FlightResult[]): Stop[] {
  return flights.length === 0
    ? []
    : [
        { code: flights[0].origin || '—', caption: 'Departure' },
        ...flights.map((f, i) => {
          const next = flights[i + 1];
          const last = i === flights.length - 1;
          const code = !last && next.origin && f.destination && next.origin !== f.destination ? `${f.destination}/${next.origin}` : f.destination || '—';
          return { code, caption: last ? 'Arrival' : 'Connection' };
        }),
      ];
}

/** Route drawn from the analysed flights: one stop per airport, one segment per flight with its live status. */
export default function RouteStrip({ flights, connection }: RouteStripProps) {
  const stops = buildStops(flights);
  if (stops.length === 0) return null;

  return (
    <ol className="flex flex-col sm:flex-row sm:items-start" aria-label="Your route">
      {stops.map((stop, i) => {
        const flight = flights[i];
        return (
          <React.Fragment key={`${stop.code}-${i}`}>
            <li className="flex min-w-0 items-center gap-3 sm:w-24 sm:shrink-0 sm:flex-col sm:items-center sm:gap-1.5 sm:text-center">
              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center sm:order-first" aria-hidden="true">
                <span className={`h-3 w-3 rounded-full ${i === 0 || i === stops.length - 1 ? 'bg-ink' : 'bg-coral'}`} />
              </span>
              <span className="display text-3xl sm:text-4xl text-ink">{stop.code}</span>
              <span className="flex flex-wrap items-center gap-2 sm:flex-col sm:gap-1.5">
                <span className="text-sm text-ink-muted">{stop.caption}</span>
                {i === 1 && connection && stops.length > 2 && <Badge status={connection.status} />}
              </span>
            </li>

            {flight && (
              <li
                className={`ml-[9px] border-l-2 border-dashed py-4 pl-6 sm:ml-0 sm:min-w-[8rem] sm:flex-1 sm:border-l-0 sm:py-0 sm:pl-0 ${lineTone(flight.status)}`}
              >
                <span className="hidden sm:flex items-center gap-2 pt-[9px] text-coral" aria-hidden="true">
                  <span className={`flex-1 border-t-2 border-dashed ${lineTone(flight.status)}`} />
                  <Plane className="h-4 w-4 -translate-y-[1px] fill-current" />
                  <span className={`flex-1 border-t-2 border-dashed ${lineTone(flight.status)}`} />
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:mt-3 sm:flex-col sm:text-center">
                  <span className="font-mono text-sm font-medium text-ink">{flight.flight_number || 'Unknown flight'}</span>
                  <Badge status={flight.status || 'UNKNOWN'} />
                  {flight.delay_minutes > 0 && (
                    <span className="text-sm text-status-caution">{formatMinutes(flight.delay_minutes)} late</span>
                  )}
                </span>
              </li>
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
