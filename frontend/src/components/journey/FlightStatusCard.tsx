'use client';

import React from 'react';
import { Plane, ArrowRight, Info } from 'lucide-react';
import { FlightResult, FlightStatus } from '@/types/flight';
import { formatFlightTime, formatMinutes } from '@/lib/flightTime';

const STATUS_STYLES: Record<FlightStatus, { chip: string; border: string }> = {
  ON_TIME: { chip: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', border: 'border-slate-800' },
  SCHEDULED: { chip: 'bg-sky-500/20 text-sky-300 border-sky-500/40', border: 'border-slate-800' },
  DEPARTED: { chip: 'bg-sky-500/20 text-sky-300 border-sky-500/40', border: 'border-slate-800' },
  LANDED: { chip: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', border: 'border-slate-800' },
  DELAYED: { chip: 'bg-amber-500/20 text-amber-300 border-amber-500/40', border: 'border-amber-500/30' },
  CANCELLED: { chip: 'bg-red-500/20 text-red-400 border-red-500/40', border: 'border-red-500/30' },
  DIVERTED: { chip: 'bg-red-500/20 text-red-400 border-red-500/40', border: 'border-red-500/30' },
  UNKNOWN: { chip: 'bg-slate-800 text-slate-300 border-slate-700', border: 'border-slate-800 border-dashed' },
};

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
};

function TimeCell({ label, iso, highlight }: { label: string; iso?: string | null; highlight?: boolean }) {
  const t = formatFlightTime(iso);
  return (
    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
      <span className="block text-[10px] text-slate-500 uppercase">{label}</span>
      {t ? (
        <span className={`text-sm font-bold ${highlight ? 'text-amber-300' : 'text-slate-200'}`}>
          {t.time} <span className="text-[10px] font-normal text-slate-500">UTC · {t.date}</span>
        </span>
      ) : (
        <span className="text-sm font-bold text-slate-600">—</span>
      )}
    </div>
  );
}

export default function FlightStatusCard({ flight }: { flight: FlightResult }) {
  const style = STATUS_STYLES[flight.status] ?? STATUS_STYLES.UNKNOWN;
  const expectedDeparture = flight.actual_departure || flight.estimated_departure;
  const expectedArrival = flight.actual_arrival || flight.estimated_arrival;
  const isDelayed = flight.delay_minutes > 0;
  const reasons = (flight.reason_codes ?? []).filter((code) => REASON_TEXT[code]);
  const retrieved = formatFlightTime(flight.retrieved_at);

  return (
    <div className={`p-5 rounded-2xl hud-card border ${style.border} space-y-4`}>
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <Plane className="w-4 h-4 text-sky-400" />
            <span className="text-lg font-mono font-extrabold text-white">{flight.flight_number || '—'}</span>
          </div>
          {flight.airline && <span className="block text-[11px] text-slate-400 mt-0.5">{flight.airline}</span>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${style.chip}`}>
            {flight.status.replace(/_/g, ' ')}
          </span>
          {isDelayed && (
            <span className="text-xs font-mono font-bold text-amber-300">+{formatMinutes(flight.delay_minutes)}</span>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3 font-mono text-base font-bold text-slate-200">
        <span>{flight.origin || '—'}</span>
        <ArrowRight className="w-4 h-4 text-slate-500" />
        <span>{flight.destination || '—'}</span>
      </div>

      {flight.status !== 'UNKNOWN' && (
        <div className="grid grid-cols-2 gap-2 font-mono">
          <TimeCell label="Scheduled departure" iso={flight.scheduled_departure} />
          <TimeCell
            label={flight.actual_departure ? 'Actual departure' : 'Expected departure'}
            iso={expectedDeparture}
            highlight={isDelayed}
          />
          <TimeCell label="Scheduled arrival" iso={flight.scheduled_arrival} />
          <TimeCell
            label={flight.actual_arrival ? 'Actual arrival' : 'Expected arrival'}
            iso={expectedArrival}
            highlight={isDelayed}
          />
        </div>
      )}

      {reasons.length > 0 && (
        <ul className="space-y-1">
          {reasons.map((code) => (
            <li key={code} className="flex items-start space-x-2 text-xs text-slate-400">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-sky-400" />
              <span>{REASON_TEXT[code]}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap justify-between gap-2 text-[10px] font-mono text-slate-500 border-t border-slate-800 pt-3">
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
    </div>
  );
}
