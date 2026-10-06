'use client';

import React from 'react';
import { AlertTriangle, CloudOff, CloudRain, Clock, Droplets, Eye, Gauge, Wind } from 'lucide-react';
import { AirportWeatherResult } from '@/types/weather';
import {
  formatForecastTime,
  formatTemperature,
  formatValue,
  HeroStat,
  RiskGauge,
  RiskLevelBadge,
  WeatherIcon,
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

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 space-y-4 ${
        available
          ? 'border-sky-400/20 bg-gradient-to-br from-sky-500/10 via-slate-900/80 to-slate-950'
          : 'border-amber-500/30 bg-slate-950'
      }`}
      data-testid={`journey-weather-${w.airport}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white font-mono">{w.airport}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-slate-900/80 border border-slate-700 text-slate-300">
            {roleLabel(w.roles)}
          </span>
        </div>
        {available ? (
          <RiskLevelBadge level={w.weather_risk!} />
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase border bg-slate-900 text-amber-300 border-amber-500/40">
            <CloudOff className="w-3.5 h-3.5" aria-hidden="true" />
            Weather unavailable
          </span>
        )}
      </div>

      {available && obs ? (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <WeatherIcon code={obs.weather_code} iso={obs.forecast_time} className="w-14 h-14 shrink-0" />
              <div>
                <div className="text-4xl font-bold text-white leading-none">
                  {formatTemperature(obs.temperature_c)}
                  <span className="text-xl font-semibold text-slate-300 align-top">C</span>
                </div>
                <div className="text-sm font-medium text-slate-200 mt-1">{obs.condition_text ?? 'Condition unavailable'}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {formatForecastTime(obs.forecast_time)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/10">
              <HeroStat icon={Eye} label="Visibility" value={formatValue(obs.visibility_km, 'km')} />
              <HeroStat icon={Wind} label="Wind" value={formatValue(obs.wind_speed_kt, 'kn')} />
              <HeroStat icon={Gauge} label="Gusts" value={formatValue(obs.wind_gust_kt, 'kn')} />
              <HeroStat icon={Droplets} label="Precipitation" value={formatValue(obs.precipitation_mm_per_hr, 'mm/h')} />
            </div>
          </div>
          <div className="justify-self-center">
            <RiskGauge score={w.weather_score!} level={w.weather_risk!} size="sm" testId={`journey-weather-score-${w.airport}`} />
          </div>
        </div>
      ) : null}

      {available && w.weather_score! > 0 && (
        <ul className="space-y-1">
          {w.conditions.map((c) => (
            <li key={c} className="flex items-start gap-1.5 text-xs text-slate-200">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}

      {w.warnings.length > 0 && (
        <div className="space-y-1 text-[11px] font-mono" data-testid={`journey-weather-reason-${w.airport}`}>
          {w.warnings.map((reason) => (
            <div key={reason} className={available ? 'text-amber-300/80' : 'text-amber-300'}>
              {reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JourneyWeatherPanel({ weather }: JourneyWeatherPanelProps) {
  return (
    <div className="p-6 rounded-2xl hud-card border border-slate-800 space-y-4" data-testid="journey-weather-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <CloudRain className="w-4 h-4 text-sky-400" />
          <span>Airport Weather at Flight Times</span>
        </h3>
        {weather[0] && <span className="text-[11px] font-mono text-slate-500">Source: {weather[0].source}</span>}
      </div>

      {weather.length === 0 ? (
        <p className="text-xs text-amber-300 font-mono">Weather unavailable: no weather data was returned for this journey.</p>
      ) : (
        <div className="space-y-3">
          {weather.map((w) => (
            <AirportWeather key={w.airport} w={w} />
          ))}
        </div>
      )}
    </div>
  );
}
