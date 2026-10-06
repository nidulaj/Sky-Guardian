'use client';

import React from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Cloudy,
  Moon,
  Snowflake,
  Sun,
} from 'lucide-react';
import Badge, { statusLabel } from '@/components/ui/Badge';
import { AirportWeatherResult, WeatherRiskLevel } from '@/types/weather';

// Shared by the Home page WeatherAgentCard and the Journey page JourneyWeatherPanel.
// Styling follows frontend/DESIGN.md: sand surfaces, ink text, hairlines, status-* tones.

/** Status tones for the four weather risk levels; always shown with the level text too. */
export const LEVEL_STYLES: Record<WeatherRiskLevel, { bar: string; text: string; stroke: string }> = {
  LOW: { bar: 'bg-status-safe', text: 'text-status-safe', stroke: '#2F6B4F' },
  MODERATE: { bar: 'bg-status-caution', text: 'text-status-caution', stroke: '#8A5A12' },
  HIGH: { bar: 'bg-status-high', text: 'text-status-high', stroke: '#A4461A' },
  VERY_HIGH: { bar: 'bg-status-danger', text: 'text-status-danger', stroke: '#B8321C' },
};

/** sand-300: the unfilled track of bars and the gauge. */
const TRACK = '#DFD7C9';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

export function formatValue(value: number | null | undefined, unit: string, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return `${Number(value.toFixed(digits))} ${unit}`.trim();
}

export function formatTemperature(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Math.round(value)}°`;
}

/** Shows the forecast hour in the airport's own local time, as sent by the backend. */
export function formatForecastTime(iso: string | null | undefined): string {
  if (!iso) return 'Unknown time';
  const m = iso.match(ISO_RE);
  if (!m) return iso;
  const [, , month, day, hour, minute, offset] = m;
  const zone = !offset || offset === 'Z' || offset === '+00:00' ? 'UTC' : `UTC${offset}`;
  return `${day} ${MONTHS[Number(month) - 1]}, ${hour}:${minute} local (${zone})`;
}

/** Airport-local hour (0-23) of a backend ISO timestamp, without browser timezone conversion. */
export function localHour(iso: string | null | undefined): number | null {
  const m = iso?.match(ISO_RE);
  return m ? Number(m[4]) : null;
}

/** "3 PM" style label for the hourly strip. */
export function formatHourLabel(iso: string | null | undefined): string {
  const h = localHour(iso);
  if (h === null) return '—';
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

/**
 * Icon for a WMO weather code. Open-Meteo's selected variables have no day/night flag,
 * so night icons use the airport-local hour (before 06:00 or from 18:00) as an approximation.
 */
export function WeatherIcon({
  code,
  iso,
  className = 'w-6 h-6',
}: {
  code: number | null | undefined;
  iso?: string | null;
  className?: string;
}) {
  const hour = localHour(iso);
  const night = hour !== null && (hour < 6 || hour >= 18);
  let Icon: React.ElementType = Cloud;
  let color = 'text-ink-soft';

  if (code === null || code === undefined) {
    color = 'text-ink-faint';
  } else if (code === 0 || code === 1) {
    Icon = night ? Moon : Sun;
    color = night ? 'text-ink-soft' : 'text-coral';
  } else if (code === 2) {
    Icon = night ? CloudMoon : CloudSun;
    color = night ? 'text-ink-soft' : 'text-coral';
  } else if (code === 3) {
    Icon = Cloudy;
  } else if (code === 45 || code === 48) {
    Icon = CloudFog;
  } else if (code >= 51 && code <= 57) {
    Icon = CloudDrizzle;
    color = 'text-mist-deep';
  } else if (code === 65 || code === 82) {
    Icon = CloudRainWind;
    color = 'text-mist-deep';
  } else if ((code >= 61 && code <= 67) || (code >= 80 && code <= 81)) {
    Icon = CloudRain;
    color = 'text-mist-deep';
  } else if (code === 75 || code === 86) {
    Icon = Snowflake;
    color = 'text-mist-deep';
  } else if ((code >= 71 && code <= 77) || code === 85) {
    Icon = CloudSnow;
    color = 'text-mist-deep';
  } else if (code === 96 || code === 99) {
    Icon = CloudHail;
    color = 'text-status-high';
  } else if (code === 95) {
    Icon = CloudLightning;
    color = 'text-status-high';
  }
  return <Icon className={`${className} ${color}`} strokeWidth={1.5} aria-hidden="true" />;
}

/** Label-over-value cell for the hairline stat grid (same pattern as FlightStatusCard times). */
export function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-sand-50 px-3 py-3 sm:px-4">
      <dt className="eyebrow truncate tracking-[0.06em]">{label}</dt>
      <dd className="mt-1.5 truncate text-xl font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/** Hairline grid wrapper for HeroStat cells. `columns` sets the responsive column classes. */
export function StatGrid({ children, columns = 'grid-cols-2 sm:grid-cols-4' }: { children: React.ReactNode; columns?: string }) {
  return (
    <dl className={`grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 ${columns}`}>
      {children}
    </dl>
  );
}

export function RiskLevelBadge({ level, testId }: { level: WeatherRiskLevel; testId?: string }) {
  return (
    <span data-testid={testId} className="inline-flex">
      <Badge status={level} label={`${statusLabel(level)} risk`} />
    </span>
  );
}

/**
 * Semicircle meter for the 0-100 weather risk score. The filled arc carries the level
 * tone; the track is sand so severity reads against the card.
 */
export function RiskGauge({
  score,
  level,
  size = 'md',
  testId,
}: {
  score: number;
  level: WeatherRiskLevel;
  size?: 'sm' | 'md';
  testId?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const width = size === 'sm' ? 120 : 176;
  const arc = 'M 12 62 A 50 50 0 0 1 112 62';

  return (
    <div className="flex flex-col items-center" role="img" aria-label={`Weather risk ${clamped} out of 100, ${statusLabel(level)}`}>
      <svg viewBox="0 0 124 70" width={width} className="overflow-visible">
        <path d={arc} fill="none" stroke={TRACK} strokeWidth={9} strokeLinecap="round" />
        {clamped > 0 && (
          <path
            d={arc}
            fill="none"
            stroke={LEVEL_STYLES[level].stroke}
            strokeWidth={9}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${clamped} 100`}
          />
        )}
      </svg>
      <div className={`${size === 'sm' ? '-mt-9' : '-mt-12'} text-center`}>
        <div className={`display ${size === 'sm' ? 'text-3xl' : 'text-5xl'} tabular-nums text-ink`} data-testid={testId}>
          {clamped}
          <span className="font-sans text-sm font-normal tracking-normal text-ink-muted">/100</span>
        </div>
      </div>
    </div>
  );
}

/** One column of the hourly strip. Hover, focus or tap selects it for the details row. */
export function HourlyTile({
  hour,
  isNow,
  active = false,
  onSelect,
}: {
  hour: AirportWeatherResult;
  isNow: boolean;
  active?: boolean;
  onSelect?: () => void;
}) {
  const obs = hour.observation;
  const level = hour.weather_risk;
  const score = hour.weather_score;
  const label = isNow ? 'Now' : formatHourLabel(obs?.forecast_time);
  const summary = `${label}: ${obs?.condition_text ?? 'Unknown'}, ${formatTemperature(obs?.temperature_c)}C, risk ${
    score ?? 'unavailable'
  }${level ? ` ${level.replace('_', ' ')}` : ''}`;

  return (
    <button
      type="button"
      aria-label={summary}
      aria-pressed={active}
      data-testid="hourly-tile"
      onMouseEnter={onSelect}
      onFocus={onSelect}
      onClick={onSelect}
      className={`flex min-w-[4.75rem] flex-1 flex-col items-center gap-2 rounded-2xl border px-2 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${
        active ? 'border-ink bg-sand-50' : 'border-ink/10 bg-sand-100 hover:border-ink/30'
      }`}
    >
      <span className={`font-mono text-[11px] uppercase tracking-[0.08em] ${active ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
      <WeatherIcon code={obs?.weather_code} iso={obs?.forecast_time} className="h-6 w-6" />
      <span className="text-lg font-semibold tabular-nums text-ink">{formatTemperature(obs?.temperature_c)}</span>
      {/* Risk bar: sand track + filled level tone */}
      <span className="block h-1.5 w-10 overflow-hidden rounded-full bg-sand-300">
        {level && score !== null && (
          <span className={`block h-full rounded-full ${LEVEL_STYLES[level].bar}`} style={{ width: `${Math.max(score, 4)}%` }} />
        )}
      </span>
      <span className="text-sm tabular-nums text-ink-muted">{score ?? '—'}</span>
    </button>
  );
}

/** Details of the selected hour, shown under the hourly strip. */
export function HourDetails({ hour }: { hour: AirportWeatherResult }) {
  const obs = hour.observation;
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-ink/10 bg-sand-100 px-4 py-3 text-sm text-ink-soft"
      data-testid="hour-details"
    >
      <span className="font-semibold text-ink">{formatForecastTime(obs?.forecast_time)}</span>
      <span>{obs?.condition_text ?? 'Condition unavailable'}</span>
      <span>Wind {formatValue(obs?.wind_speed_kt, 'kn')}</span>
      <span>Gusts {formatValue(obs?.wind_gust_kt, 'kn')}</span>
      <span>Visibility {formatValue(obs?.visibility_km, 'km')}</span>
      <span>Precipitation {formatValue(obs?.precipitation_mm_per_hr, 'mm/h')}</span>
      {hour.weather_risk && hour.weather_score !== null ? (
        <span className="ml-auto flex items-center gap-2">
          <span className="tabular-nums">Risk {hour.weather_score}/100</span>
          <RiskLevelBadge level={hour.weather_risk} />
        </span>
      ) : (
        <span className="ml-auto font-medium text-status-caution">Risk unavailable</span>
      )}
    </div>
  );
}
