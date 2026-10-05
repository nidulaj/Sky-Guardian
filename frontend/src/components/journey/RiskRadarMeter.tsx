import React from 'react';
import { Info } from 'lucide-react';
import Badge, { statusLabel } from '@/components/ui/Badge';
import type { RiskLevel } from '@/types/journey';

interface RiskRadarMeterProps {
  score: number;
  level: RiskLevel;
  flightScore: number;
  connScore: number;
  weatherScore: number;
}

/** Weights used by the backend Risk agent (backend/app/agents/risk_agent.py). */
export const RISK_PARTS = [
  { key: 'flight', label: 'Flight status', weight: 0.4, help: 'Delays, cancellations or diversions on any leg.' },
  { key: 'connection', label: 'Connection', weight: 0.35, help: 'How much transfer time you have against the minimum.' },
  { key: 'weather', label: 'Weather', weight: 0.25, help: 'Conditions at the airports on your route.' },
] as const;

// Level bands used by the Risk agent: <30 low, <60 moderate, <80 high, otherwise very high.
const BANDS = [
  { from: 0, to: 30, label: 'Low', cls: 'bg-status-safe-bg' },
  { from: 30, to: 60, label: 'Moderate', cls: 'bg-status-caution-bg' },
  { from: 60, to: 80, label: 'High', cls: 'bg-status-high-bg' },
  { from: 80, to: 100, label: 'Very high', cls: 'bg-status-danger-bg' },
];

const clamp = (n: number) => Math.min(Math.max(n, 0), 100);

export function partTone(value: number) {
  if (value >= 80) return 'bg-status-danger';
  if (value >= 60) return 'bg-status-high';
  if (value >= 30) return 'bg-status-caution';
  return 'bg-status-safe';
}

export default function RiskRadarMeter({ score, level, flightScore, connScore, weatherScore }: RiskRadarMeterProps) {
  const values = { flight: flightScore, connection: connScore, weather: weatherScore };
  const pointer = clamp(score);

  return (
    <div className="surface-raised p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Journey risk estimate</p>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="display text-7xl sm:text-8xl text-ink tabular-nums">{Math.round(score)}</span>
            <span className="text-2xl text-ink-muted">/ 100</span>
          </p>
        </div>
        <Badge status={level} label={`${statusLabel(level)} risk`} className="text-xs px-3 py-1.5" />
      </div>

      {/* Scale with level bands */}
      <div className="mt-6" role="img" aria-label={`Score ${Math.round(score)} out of 100, in the ${statusLabel(level).toLowerCase()} band`}>
        <div className="relative">
          <div className="flex h-3 overflow-hidden rounded-full">
            {BANDS.map((b) => (
              <span key={b.label} className={b.cls} style={{ width: `${b.to - b.from}%` }} />
            ))}
          </div>
          <span
            className="absolute -top-1.5 h-6 w-1 -translate-x-1/2 rounded-full bg-ink ring-2 ring-sand-50"
            style={{ left: `${pointer}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex text-sm text-ink-muted" aria-hidden="true">
          {BANDS.map((b) => (
            <span key={b.label} style={{ width: `${b.to - b.from}%` }} className="truncate pr-1">
              {b.label}
            </span>
          ))}
        </div>
      </div>

      {/* Weighted parts */}
      <div className="mt-7 border-t border-ink/10 pt-6">
        <p className="eyebrow">How the score is built</p>
        <ul className="mt-4 grid gap-5 sm:grid-cols-3 sm:gap-6">
          {RISK_PARTS.map((part) => {
            const value = clamp(values[part.key]);
            return (
              <li key={part.key} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-medium text-ink">{part.label}</span>
                  <span className="font-mono text-sm text-ink-muted">{Math.round(part.weight * 100)}%</span>
                </div>
                <div
                  className="mt-2 h-2 rounded-full bg-sand-300"
                  role="img"
                  aria-label={`${part.label}: ${Math.round(value)} out of 100, weight ${Math.round(part.weight * 100)} percent`}
                >
                  <div className={`h-2 rounded-full ${partTone(value)}`} style={{ width: `${value}%` }} />
                </div>
                <p className="mt-2 text-sm text-ink-soft">
                  <span className="font-medium text-ink tabular-nums">{Math.round(value)}/100</span>
                  {' · adds '}
                  <span className="tabular-nums">{(value * part.weight).toFixed(1)}</span> pts
                </p>
                <p className="mt-1 text-sm text-ink-muted leading-snug">{part.help}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-6 flex gap-2.5 rounded-2xl bg-sand-100 px-4 py-3 text-sm text-ink-soft leading-relaxed">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
        <span>
          This is a weighted estimate, not a probability: a score of {Math.round(score)} does not mean a {Math.round(score)}% chance of
          disruption. Use it to decide how closely to watch your trip.
        </span>
      </p>
    </div>
  );
}
