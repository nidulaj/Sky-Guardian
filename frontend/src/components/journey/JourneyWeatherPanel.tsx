'use client';

import React from 'react';
import { AlertTriangle, Clock, CloudOff } from 'lucide-react';
import { AirportWeatherResult } from '@/types/weather';
import {
  formatForecastTime,
  formatTemperature,
  formatValue,
  HeroStat,
  RiskGauge,
  RiskLevelBadge,
  StatGrid,
  WeatherIcon,
  weatherImage,
  weatherScene,
} from '@/components/weather/weatherDisplay';

interface JourneyWeatherPanelProps {
  /** The Weather Agent's per-airport results from /api/journeys/analyze (weather_conditions). */
  weather: AirportWeatherResult[];
}

const ROLE_LABELS: Record<string, string> = {
  origin: 'Origin',
  transfer: 'Transfer',
  destination: 'Destination',
};

function roleLabel(roles: string[]): string {
  return roles.length ? roles.map((r) => ROLE_LABELS[r] ?? r).join(' / ') : 'Airport';
}

function AirportWeather({ w }: { w: AirportWeatherResult }) {
  const obs = w.observation;
  const available = w.status === 'available' && w.weather_score !== null && w.weather_risk !== null;
  // Photo of the forecast weather behind the card (clear, cloudy, fog, rain, snow, storm, night).
  const image = available ? weatherImage(obs?.weather_code, obs?.forecast_time) : null;
  const photo = image !== null;

  return (
    <article
      className={`relative isolate overflow-hidden rounded-3xl border p-5 sm:p-6 ${
        photo
          ? 'border-ink/10 bg-cabin-dark bg-cover bg-center text-white'
          : available
            ? 'border-ink/10 bg-sand-50'
            : 'border-dashed border-status-caution/40 bg-status-caution-bg/40'
      }`}
      style={photo ? { backgroundImage: `url('${image}')` } : undefined}
      data-testid={`journey-weather-${w.airport}`}
      data-weather-scene={photo ? weatherScene(obs?.weather_code, obs?.forecast_time) ?? undefined : undefined}
    >
      {photo && (
        // Darkens every photo (bright sky to night storm) enough for white text (WCAG AA).
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-cabin-dark/80 via-cabin-dark/60 to-cabin-dark/80"
          aria-hidden="true"
        />
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`eyebrow ${photo ? 'text-sand-100' : ''}`}>{roleLabel(w.roles)}</p>
          <h4 className={`display mt-1 text-4xl sm:text-5xl ${photo ? 'text-white' : 'text-ink'}`}>{w.airport}</h4>
        </div>
        {available ? (
          <RiskLevelBadge level={w.weather_risk!} />
        ) : (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-status-caution-bg px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-status-caution">
            <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
            Weather unavailable
          </span>
        )}
      </div>

      {available && obs ? (
        <>
          <div className="mt-5 grid grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-center gap-4">
              <WeatherIcon
                code={obs.weather_code}
                iso={obs.forecast_time}
                className={`h-14 w-14 shrink-0 ${photo ? '!text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]' : ''}`}
              />
              <div className="min-w-0">
                <p className={`display text-5xl tabular-nums ${photo ? 'text-white' : 'text-ink'}`}>
                  {formatTemperature(obs.temperature_c)}
                  <span className={`align-top text-2xl ${photo ? 'text-sand-200' : 'text-ink-soft'}`}>C</span>
                </p>
                <p className={`accent mt-1 text-2xl ${photo ? 'text-coral-peach' : 'text-ink'}`}>
                  {obs.condition_text ?? 'Condition unavailable'}
                </p>
                <p className={`mt-1 flex items-center gap-1.5 text-sm ${photo ? 'text-sand-100' : 'text-ink-muted'}`}>
                  <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {formatForecastTime(obs.forecast_time)}
                </p>
              </div>
            </div>
            <div className="justify-self-center sm:justify-self-end">
              <RiskGauge
                score={w.weather_score!}
                level={w.weather_risk!}
                size="sm"
                tone={photo ? 'light' : 'dark'}
                testId={`journey-weather-score-${w.airport}`}
              />
            </div>
          </div>

          <div className="mt-5">
            <StatGrid>
              <HeroStat label="Visibility" value={formatValue(obs.visibility_km, 'km')} />
              <HeroStat label="Wind" value={formatValue(obs.wind_speed_kt, 'kn')} />
              <HeroStat label="Gusts" value={formatValue(obs.wind_gust_kt, 'kn')} />
              <HeroStat label="Precip." value={formatValue(obs.precipitation_mm_per_hr, 'mm/h')} />
            </StatGrid>
          </div>

          {w.weather_score! > 0 && (
            <ul className="mt-4 space-y-1.5">
              {w.conditions.map((c) => (
                <li key={c} className={`flex items-start gap-2 text-base ${photo ? 'text-white' : 'text-ink'}`}>
                  <AlertTriangle className={`mt-1 h-4 w-4 shrink-0 ${photo ? 'text-status-caution-bg' : 'text-status-caution'}`} aria-hidden="true" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {w.warnings.length > 0 && (
        <div className="mt-4 space-y-1.5" data-testid={`journey-weather-reason-${w.airport}`}>
          {w.warnings.map((reason) => (
            <p key={reason} className={`flex items-start gap-2 text-sm ${photo ? 'text-sand-100' : available ? 'text-ink-soft' : 'text-ink'}`}>
              <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${photo ? 'text-status-caution-bg' : 'text-status-caution'}`} aria-hidden="true" />
              <span>{reason}</span>
            </p>
          ))}
        </div>
      )}
    </article>
  );
}

export default function JourneyWeatherPanel({ weather }: JourneyWeatherPanelProps) {
  return (
    <div className="space-y-4" data-testid="journey-weather-panel">
      <p className="text-base text-ink-soft">
        Forecast at each airport for the hour of your flight.
        {weather[0] && <span className="text-ink-muted"> Source: {weather[0].source}.</span>}
      </p>

      {weather.length === 0 ? (
        <p className="text-base text-ink-soft">Weather unavailable: no weather data was returned for this journey.</p>
      ) : (
        <div className="grid gap-4">
          {weather.map((w) => (
            <AirportWeather key={w.airport} w={w} />
          ))}
        </div>
      )}
    </div>
  );
}
