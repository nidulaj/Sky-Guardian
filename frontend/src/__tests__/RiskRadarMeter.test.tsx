import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import RiskRadarMeter from '@/components/journey/RiskRadarMeter';
import type { RiskSummary } from '@/types/journey';

const WEIGHTS = { flight: 0.4, connection: 0.35, weather: 0.25 };

function risk(overrides: Partial<RiskSummary> = {}): RiskSummary {
  return {
    score: 73,
    level: 'HIGH',
    is_probability: false,
    flight_score: 65,
    connection_score: 90,
    weather_score: 60,
    status: 'complete',
    confidence: 0.93,
    confidence_label: 'high',
    weights: WEIGHTS,
    effective_weights: WEIGHTS,
    level_thresholds: { low_max: 29, moderate_max: 59, high_max: 79 },
    components: {
      flight: { status: 'available', score: 65, level: 'HIGH', confidence: 1, reason: 'UL001 is delayed by 90 minutes.', details: {} },
      connection: { status: 'available', score: 90, level: 'VERY_HIGH', confidence: 1, reason: 'Connection at KUL: 30 minutes between UL001 arriving and XX123 departing, against a 60-minute minimum (likely missed).', details: {} },
      weather: { status: 'available', score: 60, level: 'HIGH', confidence: 0.72, reason: 'Highest airport weather risk: KUL (Active thunderstorms)', details: {} },
    },
    explanation: [
      'Overall risk: high (73/100). This is a decision-support score, not a probability.',
      'Connection risk is very high (90/100): Connection at KUL: 30 minutes between UL001 arriving and XX123 departing, against a 60-minute minimum (likely missed).',
    ],
    uncertainty: [],
    ...overrides,
  };
}

describe('RiskRadarMeter', () => {
  it('shows the overall score, component scores and backend weights', () => {
    render(<RiskRadarMeter risk={risk()} />);
    expect(screen.getByText('73')).toBeInTheDocument();
    expect(screen.getByText('high risk')).toBeInTheDocument();

    const flight = screen.getByTestId('risk-flight-component');
    expect(flight).toHaveTextContent('65/100');
    expect(flight).toHaveTextContent('40% weight');
    expect(flight).toHaveTextContent('UL001 is delayed by 90 minutes.');
    expect(screen.getByTestId('risk-connection-component')).toHaveTextContent('35% weight');
    expect(screen.getByTestId('risk-weather-component')).toHaveTextContent('25% weight');

    const notes = screen.getByTestId('risk-confidence');
    expect(notes).toHaveTextContent('HIGH (93%)');
    expect(within(screen.getByTestId('risk-explanation')).getByText(/Connection risk is very high/)).toBeInTheDocument();
  });

  it('uses whatever weights the backend sends instead of fixed percentages', () => {
    render(<RiskRadarMeter risk={risk({ weights: { flight: 0.5, connection: 0.3, weather: 0.2 }, effective_weights: undefined })} />);
    expect(screen.getByTestId('risk-flight-component')).toHaveTextContent('50% weight');
    expect(screen.getByTestId('risk-weather-component')).toHaveTextContent('20% weight');
  });

  it('shows "Unavailable" for missing weather, never a score of 0', () => {
    const reason = 'Weather unavailable for CMB, KUL, NRT. Forecast unavailable for selected travel date.';
    render(
      <RiskRadarMeter
        risk={risk({
          score: 81,
          level: 'VERY_HIGH',
          weather_score: null,
          status: 'partial',
          confidence: 0.75,
          confidence_label: 'medium',
          effective_weights: { flight: 0.5333, connection: 0.4667, weather: 0 },
          components: {
            ...risk().components,
            weather: { status: 'missing', score: null, level: null, confidence: 0, reason, details: {} },
          },
          missing_data: ['weather'],
          uncertainty: ['Weather risk unavailable: ... Depending on the missing data it could be 80-86.'],
        })}
      />,
    );
    const weather = screen.getByTestId('risk-weather-component');
    expect(weather).toHaveTextContent('Unavailable');
    expect(weather).toHaveTextContent(reason);
    expect(weather.textContent).not.toMatch(/\d+\/100/);
    expect(screen.getByText('2 of 3 parts scored')).toBeInTheDocument();
    expect(screen.getByTestId('risk-confidence')).toHaveTextContent('MEDIUM (75%)');
    expect(screen.getByTestId('risk-confidence')).toHaveTextContent('could be 80-86');
  });

  it('marks the connection as not applicable on a direct flight', () => {
    render(
      <RiskRadarMeter
        risk={risk({
          connection_score: null,
          components: {
            ...risk().components,
            connection: { status: 'not_applicable', score: null, level: null, confidence: 1, reason: 'Direct flight: there is no connection to assess.', details: {} },
          },
        })}
      />,
    );
    const conn = screen.getByTestId('risk-connection-component');
    expect(conn).toHaveTextContent('Not applicable');
    expect(conn).toHaveTextContent('Direct flight');
    expect(screen.getByText('2 of 2 parts scored')).toBeInTheDocument();
  });

  it('shows an unknown risk without a number when nothing could be scored', () => {
    render(
      <RiskRadarMeter
        risk={risk({
          score: null,
          level: 'UNKNOWN',
          flight_score: null,
          connection_score: null,
          weather_score: null,
          status: 'insufficient_data',
          confidence: 0,
          confidence_label: 'unknown',
          components: {
            flight: { status: 'missing', score: null, level: null, confidence: 0, reason: 'Flight status unavailable.', details: {} },
            connection: { status: 'missing', score: null, level: null, confidence: 0, reason: 'Connection could not be assessed.', details: {} },
            weather: { status: 'missing', score: null, level: null, confidence: 0, reason: 'No weather data.', details: {} },
          },
          explanation: ['Overall risk: unknown. No flight, connection or weather result could be scored, so no score is given.'],
        })}
      />,
    );
    expect(screen.getByText('Risk unknown')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByTestId('risk-panel').textContent).not.toMatch(/\d+\/100/);
  });

  it('uses the earth-from-orbit backdrop', () => {
    const { container } = render(<RiskRadarMeter risk={risk()} />);
    const backdrop = container.querySelector('[style*="earth-orbit"]') as HTMLElement;
    expect(backdrop.style.backgroundImage).toContain('/images/risk/earth-orbit.jpg');
  });
});
