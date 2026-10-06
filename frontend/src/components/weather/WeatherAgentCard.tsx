'use client';

import React, { useEffect, useState } from 'react';
import {
  CloudRain,
  Thermometer,
  Eye,
  Wind,
  Gauge,
  Droplets,
  RefreshCw,
  AlertTriangle,
  MapPin,
  Clock,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { getWeatherAirports } from '@/lib/api/weather';
import { Airport, AirportWeatherResult, WeatherRiskLevel } from '@/types/weather';
import { useAirportWeather, WEATHER_REFRESH_INTERVAL_MS } from './useAirportWeather';

interface WeatherAgentCardProps {
  defaultAirport?: string;
  refreshIntervalMs?: number;
}

const LEVEL_STYLES: Record<WeatherRiskLevel, { badge: string; bar: string; text: string }> = {
  LOW: { badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', bar: 'bg-emerald-400', text: 'text-emerald-400' },
  MODERATE: { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40 glow-amber', bar: 'bg-amber-400', text: 'text-amber-400' },
  HIGH: { badge: 'bg-red-500/20 text-red-400 border-red-500/40 glow-red', bar: 'bg-red-500', text: 'text-red-400' },
  VERY_HIGH: { badge: 'bg-red-500/20 text-red-400 border-red-500/40 glow-red', bar: 'bg-red-500', text: 'text-red-400' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatValue(value: number | null | undefined, unit: string, digits = 1): string {
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

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
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

function WeatherDetails({ data }: { data: AirportWeatherResult }) {
  const obs = data.observation;
  const level = data.weather_risk ?? 'LOW';
  const styles = LEVEL_STYLES[level];
  const score = data.weather_score ?? 0;
  const missing = data.missing_data.map((m) => m.replace(/^weather\./, ''));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Observation */}
      <div className="lg:col-span-3 space-y-4">
        <div className="space-y-1">
          <div className="text-2xl font-extrabold text-white" data-testid="weather-condition">
            {obs?.condition_text ?? 'Condition unavailable'}
          </div>
          <div className="flex items-center space-x-1.5 text-xs font-mono text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Forecast for {formatForecastTime(obs?.forecast_time)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Metric icon={Thermometer} label="Temperature" value={formatValue(obs?.temperature_c, '°C')} />
          <Metric icon={Eye} label="Visibility" value={formatValue(obs?.visibility_km, 'km')} />
          <Metric icon={Wind} label="Wind" value={formatValue(obs?.wind_speed_kt, 'kn')} />
          <Metric icon={Gauge} label="Gusts" value={formatValue(obs?.wind_gust_kt, 'kn')} />
          <Metric icon={Droplets} label="Precipitation" value={formatValue(obs?.precipitation_mm_per_hr, 'mm/h')} />
          <Metric icon={CloudRain} label="WMO Code" value={obs?.weather_code != null ? String(obs.weather_code) : '—'} />
        </div>
      </div>

      {/* Risk assessment */}
      <div className="lg:col-span-2 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-slate-500 uppercase">Weather Risk</span>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider border ${styles.badge}`}
            data-testid="weather-risk-level"
          >
            {level.replace('_', ' ')}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-xs text-slate-500 uppercase">Risk Score</span>
            <span className={`text-lg font-bold ${styles.text}`} data-testid="weather-risk-score">
              {score}/100
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${score}%` }} />
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-mono text-slate-500 uppercase">Risk Factors</span>
          {score === 0 ? (
            <p className="text-xs text-slate-300">No significant weather hazards at this hour.</p>
          ) : (
            <ul className="space-y-1" data-testid="weather-risk-factors">
              {data.conditions.map((c) => (
                <li key={c} className="flex items-start space-x-1.5 text-xs text-slate-300">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-1 text-[11px] font-mono text-slate-500">
          <div>Confidence: {Math.round(data.confidence * 100)}%</div>
          {missing.length > 0 && <div>Not provided by source: {missing.join(', ')}</div>}
          {data.warnings.map((w) => (
            <div key={w} className="text-amber-400/80">{w}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WeatherAgentCard({
  defaultAirport = 'CMB',
  refreshIntervalMs = WEATHER_REFRESH_INTERVAL_MS,
}: WeatherAgentCardProps) {
  const [airport, setAirport] = useState(defaultAirport);
  const [airports, setAirports] = useState<Airport[]>([]);
  const { data, error, loading, lastUpdated, refresh } = useAirportWeather(airport, refreshIntervalMs);

  useEffect(() => {
    const controller = new AbortController();
    getWeatherAirports(controller.signal)
      .then(setAirports)
      .catch(() => {
        // The selector falls back to the current airport; the weather request reports errors.
      });
    return () => controller.abort();
  }, []);

  const options = airports.length ? airports : [{ code: airport, name: airport, city: '' } as Airport];
  const selected = airports.find((a) => a.code === airport);

  return (
    <Card className="space-y-6" data-testid="weather-agent-card">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <CloudRain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">WEATHER AGENT</h3>
            <div className="flex items-center space-x-1.5 text-xs text-slate-400">
              <MapPin className="w-3.5 h-3.5" />
              <span>{selected ? `${selected.name}, ${selected.city}` : airport}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="weather-airport" className="sr-only">
            Airport
          </label>
          <select
            id="weather-airport"
            value={airport}
            onChange={(e) => setAirport(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          >
            {options.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code}{a.city ? ` — ${a.city}` : ''}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh weather">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Body */}
      {error ? (
        <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 text-sm text-amber-300 flex items-center justify-between gap-4" role="alert">
          <span className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Weather data temporarily unavailable.</span>
          </span>
          <Button variant="ghost" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : !data ? (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-400 font-mono" role="status">
          Loading weather data...
        </div>
      ) : (
        <WeatherDetails data={data} />
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
        <div className="flex items-center gap-2">
          <span>Source: {data?.source ?? '—'}</span>
          {data?.is_mock && <Badge status="DEMO_DATA" label="Demo Data" />}
        </div>
        {lastUpdated && !error && <span>Last updated {lastUpdated.toLocaleTimeString()}</span>}
      </div>
    </Card>
  );
}
