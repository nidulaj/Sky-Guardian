'use client';

import React from 'react';
import { AlertTriangle, CloudOff, CloudRain, Clock, Droplets, Eye, Gauge, Thermometer, Wind } from 'lucide-react';
import { AirportWeatherResult } from '@/types/weather';
import { formatForecastTime, formatValue, LEVEL_STYLES, Metric, RiskLevelBadge } from '@/components/weather/weatherDisplay';

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
      className={`p-4 rounded-xl bg-slate-950 border space-y-3 ${available ? 'border-slate-800' : 'border-amber-500/30'}`}
      data-testid={`journey-weather-${w.airport}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white font-mono">{w.airport}</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-900 border border-slate-800 text-slate-400">
            {roleLabel(w.roles)}
          </span>
        </div>
        {available ? (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold font-mono ${LEVEL_STYLES[w.weather_risk!].text}`}>{w.weather_score}/100</span>
            <RiskLevelBadge level={w.weather_risk!} />
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase border bg-slate-900 text-amber-300 border-amber-500/40">
            <CloudOff className="w-3.5 h-3.5" />
            Weather unavailable
          </span>
        )}
      </div>

      {available && obs ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-200">{obs.condition_text ?? 'Condition unavailable'}</span>
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              {formatForecastTime(obs.forecast_time)}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Metric icon={Thermometer} label="Temp" value={formatValue(obs.temperature_c, '°C')} />
            <Metric icon={Eye} label="Visibility" value={formatValue(obs.visibility_km, 'km')} />
            <Metric icon={Wind} label="Wind" value={formatValue(obs.wind_speed_kt, 'kn')} />
            <Metric icon={Gauge} label="Gusts" value={formatValue(obs.wind_gust_kt, 'kn')} />
            <Metric icon={Droplets} label="Precip" value={formatValue(obs.precipitation_mm_per_hr, 'mm/h')} />
          </div>
          {w.weather_score! > 0 && (
            <ul className="space-y-1">
              {w.conditions.map((c) => (
                <li key={c} className="flex items-start gap-1.5 text-xs text-slate-300">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {w.warnings.length > 0 && (
        <div className="space-y-1 text-[11px] font-mono" data-testid={`journey-weather-reason-${w.airport}`}>
          {w.warnings.map((reason) => (
            <div key={reason} className={available ? 'text-amber-400/80' : 'text-amber-300'}>
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
