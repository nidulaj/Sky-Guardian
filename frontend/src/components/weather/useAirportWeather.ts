'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAirportHourlyWeather, getAirportWeather } from '@/lib/api/weather';
import { AirportWeatherResult } from '@/types/weather';

// Matches the backend's Open-Meteo cache (WEATHER_CACHE_TTL_SECONDS = 600): refreshing
// more often would only return the same cached forecast.
export const WEATHER_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
export const HOURLY_FORECAST_HOURS = 12;

interface WeatherState {
  data: AirportWeatherResult | null;
  /** null while loading or when the hourly forecast failed; the current conditions still show. */
  hourly: AirportWeatherResult[] | null;
  error: boolean;
  loading: boolean;
  lastUpdated: Date | null;
}

export function useAirportWeather(airport: string, refreshIntervalMs: number = WEATHER_REFRESH_INTERVAL_MS) {
  const [state, setState] = useState<WeatherState>({
    data: null,
    hourly: null,
    error: false,
    loading: true,
    lastUpdated: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));

    Promise.allSettled([
      getAirportWeather(airport, controller.signal),
      getAirportHourlyWeather(airport, HOURLY_FORECAST_HOURS, controller.signal),
    ]).then(([current, hourly]) => {
      if (controller.signal.aborted) return; // superseded by a newer request
      if (current.status === 'rejected') {
        setState({ data: null, hourly: null, error: true, loading: false, lastUpdated: null });
        return;
      }
      setState({
        data: current.value,
        hourly: hourly.status === 'fulfilled' ? hourly.value : null,
        error: false,
        loading: false,
        lastUpdated: new Date(),
      });
    });

    return () => controller.abort();
  }, [airport, reloadKey]);

  useEffect(() => {
    if (!refreshIntervalMs) return;
    const id = setInterval(refresh, refreshIntervalMs);
    return () => clearInterval(id);
  }, [refresh, refreshIntervalMs, airport]);

  // Never show the previous airport's weather while a new airport is loading.
  const current = state.data && state.data.airport === airport;
  const data = current ? state.data : null;
  const hourly = current && state.hourly?.every((h) => h.airport === airport) ? state.hourly : null;

  return { ...state, data, hourly, refresh };
}
