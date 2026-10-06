import { API_BASE_URL } from '@/lib/api/client';
import { Airport, AirportWeatherResult } from '@/types/weather';

// Weather always comes from the SkyGuardian backend (Weather Agent), never from
// Open-Meteo directly, so provider details and scoring stay server-side.

export class WeatherApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'WeatherApiError';
  }
}

export async function getAirportWeather(airport: string, signal?: AbortSignal): Promise<AirportWeatherResult> {
  const params = new URLSearchParams({ airport });
  const response = await fetch(`${API_BASE_URL}/api/weather?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new WeatherApiError(`Failed to load weather for ${airport}: ${response.status}`, response.status);
  }
  return response.json();
}

export async function getWeatherAirports(signal?: AbortSignal): Promise<Airport[]> {
  const response = await fetch(`${API_BASE_URL}/api/weather/airports`, { signal });

  if (!response.ok) {
    throw new WeatherApiError(`Failed to load airports: ${response.status}`, response.status);
  }
  return response.json();
}
