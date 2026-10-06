'use client';

import React from 'react';
import {
  AlertTriangle,
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
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Sun,
} from 'lucide-react';
import { AirportWeatherResult, WeatherRiskLevel } from '@/types/weather';

// Shared by the Home page WeatherAgentCard and the Journey page JourneyWeatherPanel.

/**
 * Status colours for the four weather risk levels (good / warning / serious / critical).
 * Always shown together with the level text and an icon, never colour alone.
 */
export const LEVEL_STYLES: Record<
  WeatherRiskLevel,
  { badge: string; bar: string; track: string; text: string; stroke: string }
> = {
  LOW: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    bar: 'bg-emerald-400',
    track: 'bg-emerald-400/15',
    text: 'text-emerald-300',
    stroke: '#34d399',
  },
  MODERATE: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    bar: 'bg-amber-400',
    track: 'bg-amber-400/15',
    text: 'text-amber-300',
    stroke: '#fbbf24',
  },
  HIGH: {
    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
    bar: 'bg-orange-500',
    track: 'bg-orange-500/15',
    text: 'text-orange-300',
    stroke: '#f97316',
  },
  VERY_HIGH: {
    badge: 'bg-red-500/15 text-red-300 border-red-500/40',
    bar: 'bg-red-500',
    track: 'bg-red-500/15',
    text: 'text-red-300',
    stroke: '#ef4444',
  },
};

const LEVEL_ICONS: Record<WeatherRiskLevel, React.ElementType> = {
  LOW: ShieldCheck,
  MODERATE: AlertTriangle,
  HIGH: ShieldAlert,
  VERY_HIGH: ShieldAlert,
};

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
  let color = 'text-slate-300';

  if (code === null || code === undefined) {
    Icon = Cloud;
    color = 'text-slate-500';
  } else if (code === 0 || code === 1) {
    Icon = night ? Moon : Sun;
    color = night ? 'text-slate-200' : 'text-amber-300';
  } else if (code === 2) {
    Icon = night ? CloudMoon : CloudSun;
    color = night ? 'text-slate-200' : 'text-amber-200';
  } else if (code === 3) {
    Icon = Cloudy;
  } else if (code === 45 || code === 48) {
    Icon = CloudFog;
  } else if (code >= 51 && code <= 57) {
    Icon = CloudDrizzle;
    color = 'text-sky-300';
  } else if (code === 65 || code === 82) {
    Icon = CloudRainWind;
    color = 'text-sky-300';
  } else if ((code >= 61 && code <= 67) || (code >= 80 && code <= 81)) {
    Icon = CloudRain;
    color = 'text-sky-300';
  } else if (code === 75 || code === 86) {
    Icon = Snowflake;
    color = 'text-sky-100';
  } else if ((code >= 71 && code <= 77) || code === 85) {
    Icon = CloudSnow;
    color = 'text-sky-100';
  } else if (code === 96 || code === 99) {
    Icon = CloudHail;
    color = 'text-violet-300';
  } else if (code === 95) {
    Icon = CloudLightning;
    color = 'text-violet-300';
  }
  return <Icon className={`${className} ${color}`} aria-hidden="true" />;
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

/** Label-over-value stat, as in the hero's bottom row. */
export function HeroStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="text-base font-semibold text-white truncate">{value}</div>
    </div>
  );
}

export function RiskLevelBadge({ level, testId }: { level: WeatherRiskLevel; testId?: string }) {
  const Icon = LEVEL_ICONS[level];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider border ${LEVEL_STYLES[level].badge}`}
      data-testid={testId}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {level.replace('_', ' ')}
    </span>
  );
}

/**
 * Semicircle meter for the 0-100 weather risk score. The filled arc carries the level
 * colour; the track is a dim step of the same colour so severity reads across the arc.
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
  const s = LEVEL_STYLES[level];
  const clamped = Math.max(0, Math.min(100, score));
  const width = size === 'sm' ? 112 : 168;
  const arc = 'M 12 62 A 50 50 0 0 1 112 62';

  return (
    <div className="flex flex-col items-center" role="img" aria-label={`Weather risk ${clamped} out of 100, ${level.replace('_', ' ')}`}>
      <svg viewBox="0 0 124 70" width={width} className="overflow-visible">
        <path d={arc} fill="none" stroke={s.stroke} strokeOpacity={0.18} strokeWidth={10} strokeLinecap="round" />
        {clamped > 0 && (
          <path
            d={arc}
            fill="none"
            stroke={s.stroke}
            strokeWidth={10}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${clamped} 100`}
          />
        )}
      </svg>
      <div className={`${size === 'sm' ? '-mt-8' : '-mt-11'} text-center`}>
        <div className={`${size === 'sm' ? 'text-xl' : 'text-3xl'} font-bold text-white leading-none`} data-testid={testId}>
          {clamped}
          <span className="text-xs font-normal text-slate-500">/100</span>
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
      className={`flex-1 min-w-[4.5rem] flex flex-col items-center gap-1.5 py-3 rounded-2xl border outline-none transition focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
        active ? 'bg-sky-500/15 border-sky-500/40' : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'
      }`}
    >
      <span className={`text-[11px] font-semibold ${active ? 'text-sky-200' : 'text-slate-400'}`}>{label}</span>
      <WeatherIcon code={obs?.weather_code} iso={obs?.forecast_time} className="w-6 h-6" />
      <span className="text-sm font-bold text-white">{formatTemperature(obs?.temperature_c)}</span>
      {/* Risk bar: dim track + filled level colour */}
      <div className={`w-10 h-1 rounded-full overflow-hidden ${level ? LEVEL_STYLES[level].track : 'bg-slate-800'}`}>
        {level && score !== null && (
          <div className={`h-full rounded-full ${LEVEL_STYLES[level].bar}`} style={{ width: `${Math.max(score, 4)}%` }} />
        )}
      </div>
      <span className="text-[10px] text-slate-500">{score ?? '—'}</span>
    </button>
  );
}

/** Details of the selected hour, shown under the hourly strip. */
export function HourDetails({ hour }: { hour: AirportWeatherResult }) {
  const obs = hour.observation;
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300"
      data-testid="hour-details"
    >
      <span className="font-semibold text-white">{formatForecastTime(obs?.forecast_time)}</span>
      <span>{obs?.condition_text ?? 'Condition unavailable'}</span>
      <span>Wind {formatValue(obs?.wind_speed_kt, 'kn')}</span>
      <span>Gusts {formatValue(obs?.wind_gust_kt, 'kn')}</span>
      <span>Visibility {formatValue(obs?.visibility_km, 'km')}</span>
      <span>Precipitation {formatValue(obs?.precipitation_mm_per_hr, 'mm/h')}</span>
      {hour.weather_risk && hour.weather_score !== null ? (
        <span className="ml-auto flex items-center gap-2">
          <span className="text-slate-400">Risk {hour.weather_score}/100</span>
          <RiskLevelBadge level={hour.weather_risk} />
        </span>
      ) : (
        <span className="ml-auto text-amber-300">Risk unavailable</span>
      )}
    </div>
  );
}
