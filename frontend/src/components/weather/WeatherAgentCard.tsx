'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, MapPin, Clock, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { getWeatherAirports } from '@/lib/api/weather';
import { Airport, AirportWeatherResult } from '@/types/weather';
import { useAirportWeather, WEATHER_REFRESH_INTERVAL_MS } from './useAirportWeather';
import {
  formatForecastTime,
  formatTemperature,
  formatValue,
  HeroStat,
  HourDetails,
  HourlyTile,
  RiskGauge,
  RiskLevelBadge,
  StatGrid,
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
    <div
      className="relative isolate flex h-full flex-col justify-between gap-6 overflow-hidden rounded-3xl bg-cabin-dark bg-cover bg-center p-5 sm:p-7"
      style={{ backgroundImage: "url('/images/weather-sky.jpg')" }}
      data-testid="weather-conditions-panel"
    >
      {/* Darkens the sky photo on the text side so white text stays readable (WCAG AA). */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-r from-cabin-dark/85 via-cabin-dark/55 to-cabin-dark/15"
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-sand-100">Now at the airport</p>
          <p className="display mt-3 text-7xl text-white sm:text-8xl tabular-nums" data-testid="weather-temperature">
            {formatTemperature(obs?.temperature_c)}
            <span className="align-top text-3xl text-sand-200 sm:text-4xl">C</span>
          </p>
          <p className="accent mt-2 text-3xl text-coral-peach sm:text-4xl" data-testid="weather-condition">
            {obs?.condition_text ?? 'Condition unavailable'}
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-sand-100">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Forecast for {formatForecastTime(obs?.forecast_time)}</span>
          </p>
        </div>
        <WeatherIcon
          code={obs?.weather_code}
          iso={obs?.forecast_time}
          className="h-20 w-20 shrink-0 !text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:h-24 sm:w-24"
        />
      </div>

      <StatGrid>
        <HeroStat label="Visibility" value={formatValue(obs?.visibility_km, 'km')} />
        <HeroStat label="Wind" value={formatValue(obs?.wind_speed_kt, 'kn')} />
        <HeroStat label="Gusts" value={formatValue(obs?.wind_gust_kt, 'kn')} />
        <HeroStat label="Precip." value={formatValue(obs?.precipitation_mm_per_hr, 'mm/h')} />
      </StatGrid>
    </div>
  );
}

function RiskWidget({ data }: { data: AirportWeatherResult }) {
  const level = data.weather_risk ?? 'LOW';
  const score = data.weather_score ?? 0;

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-ink/10 bg-sand-100 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Weather risk</p>
        <RiskLevelBadge level={level} testId="weather-risk-level" />
      </div>

      <RiskGauge score={score} level={level} testId="weather-risk-score" />

      <div className="border-t border-ink/10 pt-4">
        <p className="eyebrow">Risk factors</p>
        {score === 0 ? (
          <p className="mt-2 text-base text-ink-soft">No significant weather hazards at this hour.</p>
        ) : (
          <ul className="mt-2 space-y-1.5" data-testid="weather-risk-factors">
            {data.conditions.map((c) => (
              <li key={c} className="flex items-start gap-2 text-base text-ink">
                <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-status-caution" aria-hidden="true" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto space-y-1 border-t border-ink/10 pt-4 text-sm text-ink-muted">
        <p>Confidence {Math.round(data.confidence * 100)}%</p>
        {data.warnings.map((w) => (
          <p key={w} className="text-status-caution">{w}</p>
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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">Hourly forecast</p>
        <p className="hidden text-sm text-ink-muted sm:block">Bar = weather risk per hour · select an hour for details</p>
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
        <p className="text-base text-ink-soft">Hourly forecast unavailable.</p>
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
    <div className="surface-raised space-y-6 p-5 sm:p-8" data-testid="weather-agent-card">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="eyebrow">Weather forecast</p>
          <h3 className="display mt-2 text-4xl text-ink sm:text-5xl">{airport}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-base text-ink-soft">
            <MapPin className="h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
            <span>{airportLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="weather-airport" className="sr-only">
            Airport
          </label>
          <select
            id="weather-airport"
            value={airport}
            onChange={(e) => setAirport(e.target.value)}
            className="h-11 rounded-full border border-ink/15 bg-sand-50 px-4 font-mono text-sm text-ink transition-colors hover:border-ink/30 focus:border-ink focus:outline-none"
          >
            {options.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code}{a.city ? ` — ${a.city}` : ''}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={refresh} disabled={loading} aria-label="Refresh weather">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Body */}
      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-status-danger/30 bg-status-danger-bg p-5">
          <span className="flex items-center gap-2 text-base text-ink">
            <AlertTriangle className="h-5 w-5 shrink-0 text-status-danger" aria-hidden="true" />
            <span>Weather data temporarily unavailable.</span>
          </span>
          <Button variant="secondary" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : !data ? (
        <div role="status" className="rounded-3xl border border-dashed border-ink/20 p-6 text-base text-ink-soft">
          Loading weather data...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CurrentConditions data={data} />
            </div>
            <RiskWidget data={data} />
          </div>
          <HourlyForecast hourly={hourly} />
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink/10 pt-4 text-sm text-ink-muted">
        {lastUpdated && !error && <span>Last updated {lastUpdated.toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
