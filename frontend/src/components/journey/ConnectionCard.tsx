'use client';

import React from 'react';
import { Clock, ArrowRight } from 'lucide-react';
import { ConnectionSummary } from '@/types/journey';
import { ConnectionStatus } from '@/types/flight';
import { formatMinutes } from '@/lib/flightTime';

const STATUS_STYLES: Record<ConnectionStatus, { chip: string; border: string; accent: string; bar: string }> = {
  SAFE: {
    chip: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    border: 'border-emerald-500/30', accent: 'text-emerald-400', bar: 'bg-emerald-500',
  },
  MODERATE_RISK: {
    chip: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    border: 'border-amber-500/30', accent: 'text-amber-300', bar: 'bg-amber-400',
  },
  HIGH_RISK: {
    chip: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    border: 'border-orange-500/30', accent: 'text-orange-300', bar: 'bg-orange-400',
  },
  LIKELY_MISSED: {
    chip: 'bg-red-500/20 text-red-400 border-red-500/40',
    border: 'border-red-500/30', accent: 'text-red-400', bar: 'bg-red-500',
  },
  MISSED: {
    chip: 'bg-red-500/20 text-red-400 border-red-500/40',
    border: 'border-red-500/40', accent: 'text-red-400', bar: 'bg-red-600',
  },
  UNKNOWN: {
    chip: 'bg-slate-800 text-slate-300 border-slate-700',
    border: 'border-slate-800 border-dashed', accent: 'text-slate-400', bar: 'bg-slate-600',
  },
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

export default function ConnectionCard({ connection, airport, inboundFlight, outboundFlight }: ConnectionCardProps) {
  const status = (connection.status in STATUS_STYLES ? connection.status : 'UNKNOWN') as ConnectionStatus;
  const style = STATUS_STYLES[status];
  const known = status !== 'UNKNOWN' && !connection.reason_codes.some((c) => c.endsWith('_CANCELLED') || c === 'INBOUND_FLIGHT_DIVERTED');
  const available = connection.available_minutes;
  const required = connection.minimum_required_minutes;

  // Bar scale: the MCT marker sits at 50% of the bar, so twice the MCT fills it
  const scale = Math.max(required * 2, 1);
  const fill = Math.min(Math.max(available / scale, 0), 1) * 100;

  return (
    <div className={`p-6 rounded-2xl hud-card border ${style.border} space-y-4`}>
      <div className="flex justify-between items-start gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-400 uppercase">
            <Clock className={`w-4 h-4 ${style.accent}`} />
            <span>{airport ? `${airport} connection` : 'Connection'}</span>
          </div>
          {(inboundFlight || outboundFlight) && (
            <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-500">
              <span>{inboundFlight || '—'}</span>
              <ArrowRight className="w-3 h-3" />
              <span>{outboundFlight || '—'}</span>
            </div>
          )}
        </div>
        <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${style.chip}`}>
          {status.replace(/_/g, ' ')}
        </span>
      </div>

      <p className="text-sm text-slate-300">{statusText(status, connection.reason_codes)}</p>

      {known && (
        <>
          <div className="grid grid-cols-3 gap-3 text-center font-mono">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="block text-[10px] text-slate-500">AVAILABLE</span>
              <span className={`text-lg font-bold ${style.accent}`}>{formatMinutes(available)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="block text-[10px] text-slate-500">REQUIRED</span>
              <span className="text-lg font-bold text-slate-200">{formatMinutes(required)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="block text-[10px] text-slate-500">{connection.buffer_minutes < 0 ? 'SHORT BY' : 'SPARE'}</span>
              <span className={`text-lg font-bold ${connection.buffer_minutes < 0 ? 'text-red-400' : 'text-slate-200'}`}>
                {formatMinutes(Math.abs(connection.buffer_minutes))}
              </span>
            </div>
          </div>

          <div
            className="relative h-2 rounded-full bg-slate-800"
            role="img"
            aria-label={`${available} minutes available, ${required} minutes required`}
          >
            <div className={`h-2 rounded-full ${style.bar}`} style={{ width: `${fill}%` }} />
            <div className="absolute top-[-4px] left-1/2 w-0.5 h-4 bg-slate-300" />
            <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] font-mono text-slate-500">MCT</span>
          </div>
        </>
      )}

      {connection.reason_codes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3">
          {connection.reason_codes.map((code) => (
            <span
              key={code}
              className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-400"
            >
              {REASON_TEXT[code] ?? code.replace(/_/g, ' ').toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
