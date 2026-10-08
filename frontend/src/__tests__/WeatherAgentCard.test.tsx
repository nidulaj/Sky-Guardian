import React from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import WeatherAgentCard, { formatForecastTime } from '@/components/weather/WeatherAgentCard';
import { mockWeatherBackend, requestedUrls, weatherResult } from '@/test/weatherFixtures';

describe('WeatherAgentCard', () => {
  it('shows the loading state while weather is requested', () => {
    mockWeatherBackend(() => new Promise<never>(() => {}));
    render(<WeatherAgentCard />);
    expect(screen.getByText('Loading weather data...')).toBeInTheDocument();
  });

  it('renders the backend weather and risk assessment', async () => {
    mockWeatherBackend();
    render(<WeatherAgentCard />);

    expect(await screen.findByTestId('weather-condition')).toHaveTextContent('Moderate rain');
    expect(screen.getByTestId('weather-temperature')).toHaveTextContent('27°C');
    expect(screen.getByText('4.2 km')).toBeInTheDocument();
    expect(screen.getByText('14 kn')).toBeInTheDocument();
    expect(screen.getByText('31 kn')).toBeInTheDocument();
    expect(screen.getByText('0.3 mm/h')).toBeInTheDocument();
    expect(screen.getByTestId('weather-risk-level')).toHaveTextContent('Moderate risk');
    expect(screen.getByTestId('weather-risk-score')).toHaveTextContent('45/100');
    expect(screen.getByText('Reduced visibility (4.2 km)')).toBeInTheDocument();
    expect(screen.getByText('Strong wind (sustained 14 kt, gusts 31 kt)')).toBeInTheDocument();
    expect(screen.getByText(/Forecast for 06 Oct, 14:00 local \(UTC\+05:30\)/)).toBeInTheDocument();
    expect(screen.getByText('Source: Open-Meteo')).toBeInTheDocument();
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    // Airport selector is populated from the backend list.
    expect(await screen.findByText('Bandaranaike International Airport, Colombo')).toBeInTheDocument();
  });

  it('shows the error state when the backend is unavailable', async () => {
    mockWeatherBackend(() => ({ status: 503, body: { detail: { message: 'Weather data temporarily unavailable.' } } }));
    render(<WeatherAgentCard />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Weather data temporarily unavailable.');
  });

  it('shows the error state on a network failure without crashing', async () => {
    mockWeatherBackend(() => Promise.reject(new TypeError('Failed to fetch')) as Promise<never>);
    render(<WeatherAgentCard />);
    expect(await screen.findByText('Weather data temporarily unavailable.')).toBeInTheDocument();
  });

  it('refetches when Refresh is clicked', async () => {
    const fetchMock = mockWeatherBackend();
    render(<WeatherAgentCard />);
    await screen.findByTestId('weather-condition');

    fireEvent.click(screen.getByRole('button', { name: 'Refresh weather' }));
    await waitFor(() =>
      expect(requestedUrls(fetchMock).filter((u) => u.includes('/api/weather?')).length).toBe(2),
    );
  });

  it('requests the newly selected airport', async () => {
    const fetchMock = mockWeatherBackend((airport) => ({
      status: 200,
      body: weatherResult({ airport, weather_risk: 'LOW', weather_score: 0, conditions: ['Clear sky'] }),
    }));
    render(<WeatherAgentCard />);
    await screen.findByText('KUL — Kuala Lumpur');

    fireEvent.change(screen.getByLabelText('Airport'), { target: { value: 'KUL' } });
    await waitFor(() => expect(requestedUrls(fetchMock)).toContain('http://localhost:8000/api/weather?airport=KUL'));
    expect(await screen.findByText('No significant weather hazards at this hour.')).toBeInTheDocument();
  });

  it('flags mock/demo data', async () => {
    mockWeatherBackend((airport) => ({ status: 200, body: weatherResult({ airport, is_mock: true, source: 'MockWeatherProvider' }) }));
    render(<WeatherAgentCard />);
    expect(await screen.findByText('Demo Data')).toBeInTheDocument();
  });

  it('auto-refreshes on the configured interval', async () => {
    const fetchMock = mockWeatherBackend();
    render(<WeatherAgentCard refreshIntervalMs={50} />);
    await waitFor(() =>
      expect(requestedUrls(fetchMock).filter((u) => u.includes('/api/weather?')).length).toBeGreaterThanOrEqual(2),
    );
    await act(async () => {});
  });

  it('never calls Open-Meteo directly', async () => {
    const fetchMock = mockWeatherBackend();
    render(<WeatherAgentCard />);
    await screen.findByTestId('weather-condition');
    expect(requestedUrls(fetchMock).every((u) => u.startsWith('http://localhost:8000/api/'))).toBe(true);
  });
});

describe('WeatherAgentCard hourly forecast', () => {
  it('renders one tile per hour from the backend, starting with Now', async () => {
    const fetchMock = mockWeatherBackend();
    render(<WeatherAgentCard />);
    const strip = await screen.findByTestId('hourly-forecast');
    const tiles = within(strip).getAllByTestId('hourly-tile');
    expect(tiles.length).toBeGreaterThan(1);
    expect(tiles[0]).toHaveTextContent('Now');
    expect(tiles[0]).toHaveTextContent('30°');
    expect(tiles[1]).toHaveTextContent('3 PM');
    expect(tiles[1].getAttribute('aria-label')).toMatch(/risk 15 LOW/);
    expect(requestedUrls(fetchMock)).toContain('http://localhost:8000/api/weather/hourly?airport=CMB&hours=12');

    // The first hour is selected; selecting another hour updates the details row.
    expect(screen.getByTestId('hour-details')).toHaveTextContent('06 Oct, 14:00 local');
    fireEvent.click(tiles[5]);
    expect(screen.getByTestId('hour-details')).toHaveTextContent('06 Oct, 19:00 local');
    expect(screen.getByTestId('hour-details')).toHaveTextContent('Risk 45/100');
    expect(tiles[5]).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps current conditions when only the hourly forecast fails', async () => {
    mockWeatherBackend(undefined, () => ({ status: 503, body: {} }));
    render(<WeatherAgentCard />);
    expect(await screen.findByTestId('weather-condition')).toHaveTextContent('Moderate rain');
    expect(screen.getByText('Hourly forecast unavailable.')).toBeInTheDocument();
  });
});

describe('formatForecastTime', () => {
  it('keeps the airport local time and offset', () => {
    expect(formatForecastTime('2026-10-06T14:00:00+05:30')).toBe('06 Oct, 14:00 local (UTC+05:30)');
    expect(formatForecastTime('2026-01-31T23:00:00Z')).toBe('31 Jan, 23:00 local (UTC)');
    expect(formatForecastTime(null)).toBe('Unknown time');
  });
});
