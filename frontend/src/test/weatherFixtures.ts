import { vi } from 'vitest';
import { Airport, AirportWeatherResult } from '@/types/weather';

export const AIRPORTS: Airport[] = [
  { code: 'CMB', name: 'Bandaranaike International Airport', city: 'Colombo', country: 'Sri Lanka', latitude: 7.1808, longitude: 79.8841 },
  { code: 'KUL', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'Malaysia', latitude: 2.7456, longitude: 101.7099 },
];

export function weatherResult(overrides: Partial<AirportWeatherResult> = {}): AirportWeatherResult {
  const airport = overrides.airport ?? 'CMB';
  return {
    airport,
    status: 'available',
    roles: [],
    weather_risk: 'MODERATE',
    weather_score: 45,
    conditions: ['Reduced visibility (4.2 km)', 'Strong wind (sustained 14 kt, gusts 31 kt)'],
    factors: { rain: false, strong_wind: true, thunderstorm: false, low_visibility: true, snow_ice: false, severe_alert: false },
    component_scores: { wind: 15, visibility: 15 },
    observation: {
      airport,
      forecast_time: '2026-10-06T14:00:00+05:30',
      condition_text: 'Moderate rain',
      weather_code: 63,
      temperature_c: 27.4,
      precipitation_mm_per_hr: 0.3,
      wind_speed_kt: 14,
      wind_gust_kt: 31,
      visibility_km: 4.2,
      thunderstorm: 'NONE',
      snow_ice: 'NONE',
      alerts: null,
      source: 'Open-Meteo',
      is_mock: false,
      retrieved_at: '2026-10-06T08:30:00+00:00',
    },
    forecast_window: 'Hourly forecast for 2026-10-06T14:00+05:30 (current conditions)',
    source: 'Open-Meteo',
    is_mock: false,
    confidence: 0.75,
    missing_data: ['weather.alerts'],
    warnings: [],
    retrieved_at: '2026-10-06T08:30:00+00:00',
    ...overrides,
  };
}

type WeatherResponder = (airport: string) => { status: number; body: unknown } | Promise<never>;
type HourlyResponder = (airport: string, hours: number) => { status: number; body: unknown };

/** Scored hours from 14:00 local (up to 23:00), risk rising later in the day. */
export function hourlyResults(airport: string, hours = 12): AirportWeatherResult[] {
  return Array.from({ length: Math.min(hours, 10) }, (_, h) => {
    const base = weatherResult({ airport });
    return {
      ...base,
      weather_score: h < 4 ? 15 : 45,
      weather_risk: h < 4 ? 'LOW' : 'MODERATE',
      observation: { ...base.observation!, forecast_time: `2026-10-06T${14 + h}:00:00+05:30`, temperature_c: 30 - h * 0.5 },
    } as AirportWeatherResult;
  });
}

/** Stubs fetch for the backend weather endpoints and records requested URLs. */
export function mockWeatherBackend(
  respond: WeatherResponder = (a) => ({ status: 200, body: weatherResult({ airport: a }) }),
  respondHourly: HourlyResponder = (a, n) => ({ status: 200, body: hourlyResults(a, n) }),
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/weather/airports') {
      return new Response(JSON.stringify(AIRPORTS), { status: 200 });
    }
    if (url.pathname === '/api/weather/hourly') {
      const result = respondHourly(url.searchParams.get('airport') ?? '', Number(url.searchParams.get('hours') ?? 12));
      return new Response(JSON.stringify(result.body), { status: result.status });
    }
    if (url.pathname === '/api/weather') {
      const result = respond(url.searchParams.get('airport') ?? '');
      if (result instanceof Promise) return result;
      return new Response(JSON.stringify(result.body), { status: result.status });
    }
    return new Response('{}', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function requestedUrls(fetchMock: ReturnType<typeof mockWeatherBackend>): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}
