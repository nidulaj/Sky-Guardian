'use client';

import React, { useEffect, useState } from 'react';
import { CloudRain, Eye, Wind, Gauge, Droplets, RefreshCw, AlertTriangle, MapPin, Clock, Search } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { getWeatherAirports } from '@/lib/api/weather';
import { Airport, AirportWeatherResult } from '@/types/weather';
import { useAirportWeather, WEATHER_REFRESH_INTERVAL_MS } from './useAirportWeather';
import {
  formatForecastTime,
  formatTemperature,
  formatValue,
  HeroStat,
  HourDetails,
  PanelButton,
  WEATHER_PANEL_CLASS,
  HourlyTile,
  RiskGauge,
  RiskLevelBadge,
  WeatherIcon,
} from './weatherDisplay';

export { formatForecastTime };

interface WeatherAgentCardProps {
  defaultAirport?: string;
  refreshIntervalMs?: number;
}

function CurrentConditions({ data }: { data: AirportWeatherResult }) {
  const obs = data.observation;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-sky-400/20 bg-gradient-to-br from-sky-500/20 via-slate-900/80 to-slate-950 p-6 sm:p-7 flex flex-col justify-between gap-6 min-h-[17rem]">
      <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-sky-400/10 blur-3xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-6xl sm:text-7xl font-bold tracking-tight text-white leading-none" data-testid="weather-temperature">
            {formatTemperature(obs?.temperature_c)}
            <span className="text-3xl sm:text-4xl font-semibold text-slate-300 align-top">C</span>
          </div>
          <div className="text-xl font-medium text-slate-200" data-testid="weather-condition">
            {obs?.condition_text ?? 'Condition unavailable'}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Forecast for {formatForecastTime(obs?.forecast_time)}</span>
          </div>
        </div>
        <WeatherIcon code={obs?.weather_code} iso={obs?.forecast_time} className="w-20 h-20 sm:w-24 sm:h-24 drop-shadow-[0_0_25px_rgba(56,189,248,0.25)] shrink-0" />
      </div>

      <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10">
        <HeroStat icon={Eye} label="Visibility" value={formatValue(obs?.visibility_km, 'km')} />
        <HeroStat icon={Wind} label="Wind" value={formatValue(obs?.wind_speed_kt, 'kn')} />
        <HeroStat icon={Gauge} label="Gusts" value={formatValue(obs?.wind_gust_kt, 'kn')} />
        <HeroStat icon={Droplets} label="Precipitation" value={formatValue(obs?.precipitation_mm_per_hr, 'mm/h')} />
      </div>
    </div>
  );
}

function RiskWidget({ data }: { data: AirportWeatherResult }) {
  const level = data.weather_risk ?? 'LOW';
  const score = data.weather_score ?? 0;
  const missing = data.missing_data.map((m) => m.replace(/^weather\./, ''));

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">Weather risk</span>
        <RiskLevelBadge level={level} testId="weather-risk-level" />
      </div>

      <RiskGauge score={score} level={level} testId="weather-risk-score" />

      <div className="space-y-1.5">
        <span className="text-[11px] text-slate-400">Risk factors</span>
        {score === 0 ? (
          <p className="text-xs text-slate-300">No significant weather hazards at this hour.</p>
        ) : (
          <ul className="space-y-1" data-testid="weather-risk-factors">
            {data.conditions.map((c) => (
              <li key={c} className="flex items-start gap-1.5 text-xs text-slate-200">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto pt-3 border-t border-slate-800 space-y-1 text-[11px] text-slate-500">
        <div>Confidence {Math.round(data.confidence * 100)}%</div>
        {missing.length > 0 && <div>Not provided by source: {missing.join(', ')}</div>}
        {data.warnings.map((w) => (
          <div key={w} className="text-amber-300/80">{w}</div>
        ))}
      </div>
    </div>
  );
}

function HourlyForecast({ hourly }: { hourly: AirportWeatherResult[] | null }) {
  const [active, setActive] = useState(0);
  const selected = hourly?.[Math.min(active, hourly.length - 1)];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200">Hourly forecast</span>
        <span className="hidden sm:inline text-[11px] text-slate-500">Bar = weather risk per hour · select an hour for details</span>
      </div>
      {hourly && hourly.length > 0 ? (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1" data-testid="hourly-forecast">
            {hourly.map((h, i) => (
              <HourlyTile
                key={h.observation?.forecast_time ?? i}
                hour={h}
                isNow={i === 0}
                active={i === active}
                onSelect={() => setActive(i)}
              />
            ))}
          </div>
          {selected && <HourDetails hour={selected} />}
        </>
      ) : (
        <p className="text-xs text-slate-500">Hourly forecast unavailable.</p>
      )}
    </div>
  );
}

export default function WeatherAgentCard({
  defaultAirport = 'CMB',
  refreshIntervalMs = WEATHER_REFRESH_INTERVAL_MS,
}: WeatherAgentCardProps) {
  const [airport, setAirport] = useState(defaultAirport);
  const [airports, setAirports] = useState<Airport[]>([]);
  const { data, hourly, error, loading, lastUpdated, refresh } = useAirportWeather(airport, refreshIntervalMs);

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
  const airportLabel = selected ? `${selected.name}, ${selected.city}` : airport;

  return (
    <div className={`${WEATHER_PANEL_CLASS} p-5 sm:p-7 space-y-6`} data-testid="weather-agent-card">
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
              <span>{airportLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <label htmlFor="weather-airport" className="sr-only">
              Airport
            </label>
            <select
              id="weather-airport"
              value={airport}
              onChange={(e) => setAirport(e.target.value)}
              className="appearance-none bg-slate-950 border border-slate-800 rounded-full pl-8 pr-4 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              {options.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code}{a.city ? ` — ${a.city}` : ''}
                </option>
              ))}
            </select>
          </div>
          <PanelButton onClick={refresh} disabled={loading} aria-label="Refresh weather">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </PanelButton>
        </div>
      </div>

      {/* Body */}
      {error ? (
        <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 text-sm text-amber-300 flex items-center justify-between gap-4" role="alert">
          <span className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Weather data temporarily unavailable.</span>
          </span>
          <PanelButton variant="ghost" onClick={refresh}>
            Retry
          </PanelButton>
        </div>
      ) : !data ? (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-400 font-mono" role="status">
          Loading weather data...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <CurrentConditions data={data} />
            </div>
            <RiskWidget data={data} />
          </div>
          <HourlyForecast hourly={hourly} />
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
        <div className="flex items-center gap-2">
          <span>Source: {data?.source ?? '—'}</span>
          {data?.is_mock && <Badge status="DEMO_DATA" label="Demo Data" />}
        </div>
        {lastUpdated && !error && <span>Last updated {lastUpdated.toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
