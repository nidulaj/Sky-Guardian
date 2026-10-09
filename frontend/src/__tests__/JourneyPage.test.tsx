import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import NewJourneyPage from '@/app/(dashboard)/dashboard/page';
import { todayISODate } from '@/lib/date';
import { weatherResult } from '@/test/weatherFixtures';
import { JourneyAnalysisResponse } from '@/types/journey';
import { AirportWeatherResult } from '@/types/weather';

const REASON = 'Forecast unavailable for selected travel date: 2026-12-01 15:30 local time at CMB is beyond the 16-day forecast range.';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/dashboard',
}));
vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      user_id: 'usr_mock_123',
      email: 'passenger@example.com',
      first_name: 'Alex',
      last_name: 'Passenger',
      role: 'PASSENGER',
      preferred_language: 'en',
    },
    token: 'mock-token',
    isAuthenticated: true,
    isAdmin: false,
    isPassenger: true,
    isLoading: false,
  }),
}));

function unavailableWeather(airport: string, roles: string[]): AirportWeatherResult {
  return {
    ...weatherResult({ airport }),
    status: 'unavailable',
    roles,
    weather_risk: null,
    weather_score: null,
    conditions: [],
    factors: null,
    component_scores: {},
    observation: null,
    forecast_window: null,
    confidence: 0,
    missing_data: ['weather'],
    warnings: [REASON.replace('CMB', airport)],
    retrieved_at: null,
  };
}

function journeyResponse(weatherAvailable: boolean): JourneyAnalysisResponse {
  const weather = weatherAvailable
    ? [
        weatherResult({ airport: 'CMB', roles: ['origin'], weather_score: 5, weather_risk: 'LOW', conditions: ['Light rainfall (0.1 mm/h)'] }),
        weatherResult({ airport: 'KUL', roles: ['transfer'], weather_score: 60, weather_risk: 'HIGH', conditions: ['Active thunderstorms'] }),
        weatherResult({ airport: 'NRT', roles: ['destination'], weather_score: 0, weather_risk: 'LOW', conditions: ['Clear sky'] }),
      ]
    : [
        unavailableWeather('CMB', ['origin']),
        unavailableWeather('KUL', ['transfer']),
        unavailableWeather('NRT', ['destination']),
      ];

  const weatherComponent = weatherAvailable
    ? { status: 'available' as const, score: 60, level: 'HIGH' as const, confidence: 0.75, reason: 'Highest airport weather risk: KUL', details: {} }
    : { status: 'missing' as const, score: null, level: null, confidence: 0, reason: `Weather unavailable for CMB, KUL, NRT. ${REASON}`, details: {} };

  return {
    journey_id: 'j1',
    trace_id: 't1',
    journey_status: weatherAvailable ? 'VERY_HIGH_RISK' : 'VERY_HIGH_RISK',
    risk: {
      score: weatherAvailable ? 82 : 89,
      level: 'VERY_HIGH',
      is_probability: false,
      flight_score: 80,
      connection_score: 100,
      weather_score: weatherAvailable ? 60 : null,
      status: weatherAvailable ? 'complete' : 'partial',
      confidence: weatherAvailable ? 0.94 : 0.75,
      confidence_label: weatherAvailable ? 'high' : 'medium',
      components: {
        flight: { status: 'available', score: 80, level: 'VERY_HIGH', confidence: 1, reason: null, details: {} },
        connection: { status: 'available', score: 100, level: 'VERY_HIGH', confidence: 1, reason: null, details: {} },
        weather: weatherComponent,
      },
      missing_data: weatherAvailable ? [] : ['weather'],
      uncertainty: weatherAvailable
        ? []
        : ['Weather risk unavailable: the score uses the available components with re-normalised weights. Depending on the missing data it could be 67-92.'],
    },
    primary_issue: 'Connection time may be insufficient.',
    connection: { available_minutes: -40, minimum_required_minutes: 60, buffer_minutes: -100, status: 'MISSED', reason_codes: [] },
    flight_statuses: [],
    weather_conditions: weather,
    policy_evidence: [],
    alternatives: [],
    recommendation: 'Rebook.',
    sources: [],
    warnings: [],
    is_demo_data: true,
    last_updated: '2026-10-06T00:00:00Z',
  };
}

function mockAnalyze(weatherAvailable: boolean, updates: Partial<JourneyAnalysisResponse> = {}) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify({ ...journeyResponse(weatherAvailable), ...updates }), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentLegs(fetchMock: ReturnType<typeof mockAnalyze>) {
  const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/journeys/analyze'));
  expect(call).toBeDefined();
  const [url, init] = call!;
  expect(String(url)).toBe('http://localhost:8000/api/journeys/analyze');
  return JSON.parse(String(init?.body)).legs as { travel_date: string }[];
}

const dateInput = (i: number) => document.getElementById(`leg-${i}-travel_date`) as HTMLInputElement;

async function runAnalysis() {
  for (const [i, flight] of [
    { flight_number: 'UL001', origin: 'CMB', destination: 'KUL' },
    { flight_number: 'XX123', origin: 'KUL', destination: 'NRT' },
  ].entries()) {
    for (const [field, value] of Object.entries(flight)) {
      fireEvent.change(document.getElementById(`leg-${i}-${field}`)!, { target: { value } });
    }
  }
  fireEvent.click(screen.getByRole('button', { name: /Check my journey/ }));
  return screen.findByTestId('journey-weather-panel');
}

describe('Journey page travel date', () => {
  it('starts with empty flight details and no sample journey controls', () => {
    mockAnalyze(true);
    render(<NewJourneyPage />);

    expect(screen.queryByText('Try a sample journey')).not.toBeInTheDocument();
    expect(screen.queryByText('Demo data')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open voice assistant' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Voice assistant' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Message SkyGuardian')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Likely missed connection|Safe connection|Cancelled flight/ })).not.toBeInTheDocument();
    for (const i of [0, 1]) {
      for (const field of ['flight_number', 'origin', 'destination']) {
        expect(document.getElementById(`leg-${i}-${field}`)).toHaveValue('');
      }
    }
  });

  it('defaults every leg to today and sends it as travel_date', async () => {
    const fetchMock = mockAnalyze(true);
    render(<NewJourneyPage />);

    const today = todayISODate();
    expect(dateInput(0)).toHaveValue(today);
    expect(dateInput(1)).toHaveValue(today);

    await runAnalysis();
    expect(sentLegs(fetchMock).map((l) => l.travel_date)).toEqual([today, today]);
    const analyzeCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/journeys/analyze'))!;
    expect(JSON.parse(String(analyzeCall[1]?.body))).not.toHaveProperty('request_alternatives');
  });

  it('sends the selected future date', async () => {
    const fetchMock = mockAnalyze(true);
    render(<NewJourneyPage />);

    fireEvent.change(dateInput(0), { target: { value: '2026-10-10' } });
    fireEvent.change(dateInput(1), { target: { value: '2026-10-11' } });

    await runAnalysis();
    expect(sentLegs(fetchMock).map((l) => l.travel_date)).toEqual(['2026-10-10', '2026-10-11']);
  });

  it('new legs copy the previous leg date instead of a hardcoded one', () => {
    mockAnalyze(true);
    render(<NewJourneyPage />);
    fireEvent.change(dateInput(1), { target: { value: '2026-10-12' } });
    fireEvent.click(screen.getByRole('button', { name: /Add a connecting flight/ }));
    expect(dateInput(2)).toHaveValue('2026-10-12');
  });
});

describe('Manual backup flight search', () => {
  it('requests alternatives for the assessed journey without sending unsaved form changes', async () => {
    const fetchMock = mockAnalyze(true, { alternative_search: { status: 'not_needed' } });
    render(<NewJourneyPage />);
    await runAnalysis();
    fireEvent.change(document.getElementById('leg-0-flight_number')!, { target: { value: 'UL226' } });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      ...journeyResponse(true), alternative_search: { status: 'no_results' },
    }), { status: 200 }));

    fireEvent.click(screen.getByRole('button', { name: 'Find backup flights' }));
    expect(await screen.findByText('No suitable route found in this search. Ask the airline for other options.')).toBeInTheDocument();
    const calls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/journeys/analyze'));
    expect(calls).toHaveLength(2);
    const first = JSON.parse(String(calls[0][1]?.body));
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({ ...first, request_alternatives: true });
    expect(document.getElementById('leg-0-flight_number')).toHaveValue('UL226');
    expect(screen.getByTestId('risk-panel')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '06 / Backup flights' })).toHaveFocus();
  });

  it('keeps the assessment visible and prevents duplicate requests while searching', async () => {
    const fetchMock = mockAnalyze(true, { alternative_search: { status: 'not_needed' } });
    render(<NewJourneyPage />);
    await runAnalysis();
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Find backup flights' }));

    const button = screen.getByRole('button', { name: 'Searching...' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: /Checking your journey/ })).toBeDisabled();
    expect(screen.getByTestId('risk-panel')).toBeInTheDocument();
    expect(screen.getByText('Checking backup flights...')).toHaveAttribute('role', 'status');
    expect(screen.queryByText('No backup route needed for this journey.')).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/journeys/analyze'))).toHaveLength(2);

    finish(new Response(JSON.stringify(journeyResponse(true)), { status: 200 }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Find backup flights' })).toBeEnabled());
  });

  it('preserves the assessment on failure and lets the passenger retry', async () => {
    const fetchMock = mockAnalyze(true, { alternative_search: { status: 'not_needed' } });
    render(<NewJourneyPage />);
    await runAnalysis();
    fetchMock.mockRejectedValueOnce(new TypeError('Network unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Find backup flights' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Backup search failed. Try again or ask the airline for options.');
    expect(screen.getByTestId('risk-panel')).toBeInTheDocument();
    expect(screen.getByText('No backup route needed for this journey.')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Find backup flights' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    await waitFor(() => expect(button).toBeEnabled());
  });
});

describe('Journey weather panel', () => {
  it('shows backup search availability alongside the risk result and voice bubble', async () => {
    mockAnalyze(true, { alternative_search: { status: 'unavailable', provider: 'AeroDataBox' } });
    render(<NewJourneyPage />);
    await runAnalysis();

    expect(screen.getByText('Routes could not be checked. Ask the airline transfer desk for options.')).toBeInTheDocument();
    expect(screen.getByTestId('risk-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open voice assistant' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Voice assistant' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bagents?\b|Supabase|RAG|policy evidence|Backup routes, ranked/i);
  });

  it('shows per-airport weather when available', async () => {
    mockAnalyze(true);
    render(<NewJourneyPage />);
    await runAnalysis();

    const kul = screen.getByTestId('journey-weather-KUL');
    expect(within(kul).getByText('Transfer')).toBeInTheDocument();
    // Moderate rain (WMO 63) at 14:00 local -> rain photo behind the card.
    expect(kul).toHaveAttribute('data-weather-scene', 'rain');
    expect(kul.style.backgroundImage).toContain('/images/weather/rain.jpg');
    expect(within(kul).getByText('Moderate rain')).toBeInTheDocument();
    expect(within(kul).getByText('27°')).toBeInTheDocument();
    expect(within(kul).getByText('4.2 km')).toBeInTheDocument();
    expect(within(kul).getByText('14 kn')).toBeInTheDocument();
    expect(within(kul).getByText('31 kn')).toBeInTheDocument();
    expect(within(kul).getByText('0.3 mm/h')).toBeInTheDocument();
    expect(within(kul).getByTestId('journey-weather-score-KUL')).toHaveTextContent('60/100');
    expect(within(kul).getByText('High risk')).toBeInTheDocument();
    expect(within(kul).getByText('Active thunderstorms')).toBeInTheDocument();
    expect(within(screen.getByTestId('journey-weather-CMB')).getByText('Origin')).toBeInTheDocument();
    expect(within(screen.getByTestId('journey-weather-NRT')).getByText('Destination')).toBeInTheDocument();

    expect(screen.getByTestId('risk-weather-component')).toHaveTextContent('60/100');
  });

  it('shows "Weather unavailable" with the reason and never a weather score', async () => {
    mockAnalyze(false);
    render(<NewJourneyPage />);
    await runAnalysis();

    for (const code of ['CMB', 'KUL', 'NRT']) {
      const card = screen.getByTestId(`journey-weather-${code}`);
      expect(within(card).getByText('Weather unavailable')).toBeInTheDocument();
      expect(card.style.backgroundImage).toBe('');
      expect(within(screen.getByTestId(`journey-weather-reason-${code}`)).getByText(/Forecast unavailable for selected travel date/)).toBeInTheDocument();
      expect(card.textContent).not.toMatch(/\/100/);
    }

    const weatherComponent = screen.getByTestId('risk-weather-component');
    expect(weatherComponent).toHaveTextContent('Unavailable');
    expect(weatherComponent).toHaveTextContent('Forecast unavailable for selected travel date');
    expect(weatherComponent.textContent).not.toMatch(/\d+\/100/);
    expect(screen.queryByText('15/100')).not.toBeInTheDocument();

    const confidence = screen.getByTestId('risk-confidence');
    expect(confidence).toHaveTextContent('MEDIUM (75%)');
    expect(confidence).toHaveTextContent('could be 67-92');
  });
});
