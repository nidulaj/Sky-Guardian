'use client';

import React from 'react';
import { WeatherRiskLevel } from '@/types/weather';

// Shared by the Home page WeatherAgentCard and the Journey page JourneyWeatherPanel.

export const LEVEL_STYLES: Record<WeatherRiskLevel, { badge: string; bar: string; text: string }> = {
  LOW: { badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', bar: 'bg-emerald-400', text: 'text-emerald-400' },
  MODERATE: { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40 glow-amber', bar: 'bg-amber-400', text: 'text-amber-400' },
  HIGH: { badge: 'bg-red-500/20 text-red-400 border-red-500/40 glow-red', bar: 'bg-red-500', text: 'text-red-400' },
  VERY_HIGH: { badge: 'bg-red-500/20 text-red-400 border-red-500/40 glow-red', bar: 'bg-red-500', text: 'text-red-400' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatValue(value: number | null | undefined, unit: string, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return `${Number(value.toFixed(digits))} ${unit}`.trim();
}

/** Shows the forecast hour in the airport's own local time, as sent by the backend. */
export function formatForecastTime(iso: string | null | undefined): string {
  if (!iso) return 'Unknown time';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!m) return iso;
  const [, , month, day, hour, minute, offset] = m;
  const zone = !offset || offset === 'Z' || offset === '+00:00' ? 'UTC' : `UTC${offset}`;
  return `${day} ${MONTHS[Number(month) - 1]}, ${hour}:${minute} local (${zone})`;
}

export function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
      <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-500 uppercase">
        <Icon className="w-3.5 h-3.5 text-sky-400" />
        <span>{label}</span>
      </div>
      <div className="text-base font-bold text-white font-mono">{value}</div>
    </div>
  );
}

export function RiskLevelBadge({ level, testId }: { level: WeatherRiskLevel; testId?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider border ${LEVEL_STYLES[level].badge}`}
      data-testid={testId}
    >
      {level.replace('_', ' ')}
    </span>
  );
}
