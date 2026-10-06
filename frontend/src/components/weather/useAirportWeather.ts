'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAirportWeather } from '@/lib/api/weather';
import { AirportWeatherResult } from '@/types/weather';

// Matches the backend's Open-Meteo cache (WEATHER_CACHE_TTL_SECONDS = 600): refreshing
// more often would only return the same cached forecast.
export const WEATHER_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

interface WeatherState {
  data: AirportWeatherResult | null;
  error: boolean;
  loading: boolean;
  lastUpdated: Date | null;
}

export function useAirportWeather(airport: string, refreshIntervalMs: number = WEATHER_REFRESH_INTERVAL_MS) {
  const [state, setState] = useState<WeatherState>({ data: null, error: false, loading: true, lastUpdated: null });
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));

    getAirportWeather(airport, controller.signal)
      .then((data) => setState({ data, error: false, loading: false, lastUpdated: new Date() }))
      .catch(() => {
        if (controller.signal.aborted) return; // superseded by a newer request
        setState({ data: null, error: true, loading: false, lastUpdated: null });
      });

    return () => controller.abort();
  }, [airport, reloadKey]);

  useEffect(() => {
    if (!refreshIntervalMs) return;
    const id = setInterval(refresh, refreshIntervalMs);
    return () => clearInterval(id);
  }, [refresh, refreshIntervalMs, airport]);

  // Never show the previous airport's weather while a new airport is loading.
  const data = state.data && state.data.airport === airport ? state.data : null;

  return { ...state, data, refresh };
}
