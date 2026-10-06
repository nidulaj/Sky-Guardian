import { describe, expect, it } from 'vitest';
import { getAirportWeather, getWeatherAirports, WeatherApiError } from '@/lib/api/weather';
import { mockWeatherBackend, requestedUrls } from '@/test/weatherFixtures';

describe('weather API service', () => {
  it('requests weather from the SkyGuardian backend, not Open-Meteo', async () => {
    const fetchMock = mockWeatherBackend();
    const result = await getAirportWeather('CMB');

    expect(result.airport).toBe('CMB');
    const [url] = requestedUrls(fetchMock);
    expect(url).toBe('http://localhost:8000/api/weather?airport=CMB');
    expect(url).not.toContain('open-meteo');
  });

  it('throws WeatherApiError with the HTTP status on failure', async () => {
    mockWeatherBackend(() => ({ status: 503, body: { detail: { message: 'Weather data temporarily unavailable.' } } }));
    await expect(getAirportWeather('CMB')).rejects.toMatchObject({ name: 'WeatherApiError', status: 503 });
    await expect(getAirportWeather('CMB')).rejects.toBeInstanceOf(WeatherApiError);
  });

  it('loads the supported airport list', async () => {
    mockWeatherBackend();
    const airports = await getWeatherAirports();
    expect(airports.map((a) => a.code)).toEqual(['CMB', 'KUL']);
  });
});
