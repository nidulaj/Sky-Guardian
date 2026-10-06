import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import NewJourneyPage from '@/app/(dashboard)/journeys/new/page';
import { todayISODate } from '@/lib/date';
import { weatherResult } from '@/test/weatherFixtures';
import { JourneyAnalysisResponse } from '@/types/journey';
import { AirportWeatherResult } from '@/types/weather';

const REASON = 'Forecast unavailable for selected travel date: 2026-12-01 15:30 local time at CMB is beyond the 16-day forecast range.';

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

function mockAnalyze(weatherAvailable: boolean) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(journeyResponse(weatherAvailable)), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentLegs(fetchMock: ReturnType<typeof mockAnalyze>) {
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe('http://localhost:8000/api/journeys/analyze');
  return JSON.parse(String(init?.body)).legs as { travel_date: string }[];
}

async function runAnalysis() {
  fireEvent.click(screen.getByRole('button', { name: /Run Disruption Telemetry/ }));
  return screen.findByTestId('journey-weather-panel');
}

describe('Journey page travel date', () => {
  it('defaults every leg to today and sends it as travel_date', async () => {
    const fetchMock = mockAnalyze(true);
    render(<NewJourneyPage />);

    const today = todayISODate();
    expect(screen.getByLabelText('Travel Date', { selector: '#travel-date-0' })).toHaveValue(today);
    expect(screen.getByLabelText('Travel Date', { selector: '#travel-date-1' })).toHaveValue(today);

    await runAnalysis();
    expect(sentLegs(fetchMock).map((l) => l.travel_date)).toEqual([today, today]);
  });

  it('sends the selected future date', async () => {
    const fetchMock = mockAnalyze(true);
    render(<NewJourneyPage />);

    fireEvent.change(screen.getByLabelText('Travel Date', { selector: '#travel-date-0' }), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('Travel Date', { selector: '#travel-date-1' }), { target: { value: '2026-10-11' } });

    await runAnalysis();
    expect(sentLegs(fetchMock).map((l) => l.travel_date)).toEqual(['2026-10-10', '2026-10-11']);
  });

  it('new legs copy the previous leg date instead of a hardcoded one', () => {
    mockAnalyze(true);
    render(<NewJourneyPage />);
    fireEvent.change(screen.getByLabelText('Travel Date', { selector: '#travel-date-1' }), { target: { value: '2026-10-12' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Connecting Flight Leg/ }));
    expect(screen.getByLabelText('Travel Date', { selector: '#travel-date-2' })).toHaveValue('2026-10-12');
  });
});

describe('Journey weather panel', () => {
  it('shows per-airport weather when available', async () => {
    mockAnalyze(true);
    render(<NewJourneyPage />);
    await runAnalysis();

    const kul = screen.getByTestId('journey-weather-KUL');
    expect(within(kul).getByText('Transfer')).toBeInTheDocument();
    expect(within(kul).getByText('Moderate rain')).toBeInTheDocument();
    expect(within(kul).getByText('27.4 °C')).toBeInTheDocument();
    expect(within(kul).getByText('4.2 km')).toBeInTheDocument();
    expect(within(kul).getByText('14 kn')).toBeInTheDocument();
    expect(within(kul).getByText('31 kn')).toBeInTheDocument();
    expect(within(kul).getByText('0.3 mm/h')).toBeInTheDocument();
    expect(within(kul).getByText('60/100')).toBeInTheDocument();
    expect(within(kul).getByText('HIGH')).toBeInTheDocument();
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
