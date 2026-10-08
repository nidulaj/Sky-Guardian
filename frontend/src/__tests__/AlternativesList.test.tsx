import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AlternativesList } from '@/components/journey/JourneyDetails';
import type { AlternativeOption } from '@/types/journey';

const option: AlternativeOption = {
  rank: 1, option_id: 'alt-1', route_summary: 'KUL -> NRT (MH088)', departure: '2026-10-09T00:00:00Z',
  arrival: '2026-10-09T07:00:00Z', duration_minutes: 420, connections: 0,
  data_mode: 'demo', price: 'UNKNOWN', availability_status: 'UNKNOWN', policy_eligibility: 'UNKNOWN',
  risk_score: 0, risk_level: 'LOW', risk_confidence: 'medium', ranking_score: 92.5,
  ranking_factors: { disruption_risk: 1 }, ranking_weights: { disruption_risk: 0.4 }, ranking_config_version: '1.0',
  ranking_reasons: ['Direct flight; no onward transfer.'], sources: [{ name: 'MockFlightSearch (Demo Data)', verified: false }],
  retrieved_at: '2026-10-08T10:00:00Z', warnings: ['Confirm seat availability with the airline.'],
};

describe('Alternative flight results', () => {
  it('keeps the summary short and preserves evidence behind closed details', () => {
    render(<AlternativesList items={[option]} search={{ status: 'partial', origin: 'KUL', destination: 'NRT', warnings: ['Location must be confirmed.'] }} />);
    expect(screen.getByText('Sample only')).toBeVisible();
    expect(screen.getByText('Sample flight. Not bookable.')).toBeVisible();
    expect(screen.getByText('Top match')).toBeVisible();
    expect(screen.getByText('Seat availability: UNKNOWN')).toBeInTheDocument();
    expect(screen.getByText('Price: UNKNOWN')).toBeInTheDocument();
    expect(screen.getByText('Rebooking eligibility: UNKNOWN')).toBeInTheDocument();
    expect(screen.getByText('Risk confidence: medium')).toBeInTheDocument();
    expect(screen.getByText(/MockFlightSearch/)).toBeInTheDocument();
    expect(screen.getByText('Location must be confirmed.')).toBeInTheDocument();
    expect(screen.getByText('Risk confidence: medium')).not.toBeVisible();
    expect(screen.getByText('Location must be confirmed.')).not.toBeVisible();
    const summary = screen.getByText('Flight details');
    fireEvent.click(summary);
    expect(summary.parentElement).toHaveAttribute('open');
    expect(screen.getByText('Ranking score: 92.50 / 100')).toBeVisible();
    expect(screen.getByText('100% / weight 40%')).toBeVisible();
    fireEvent.click(screen.getByText('Search limits & notes'));
    expect(screen.getByText('Location must be confirmed.')).toBeVisible();
  });

  it('shows airport-local times and keeps unknown seats visible for real schedules', () => {
    render(<AlternativesList items={[{ ...option, data_mode: 'timetable', risk_confidence: 'low',
      legs: [{ flight_number: 'MH088', origin: 'KUL', destination: 'NRT', origin_timezone: 'Asia/Kuala_Lumpur',
        destination_timezone: 'Asia/Tokyo', status: 'SCHEDULED', source: 'AeroDataBox', retrieved_at: option.retrieved_at!,
        data_mode: 'timetable', delay_minutes: 0, reason_codes: [] }],
    }]} />);
    expect(screen.getByText('08:00')).toBeVisible();
    expect(screen.getByText('16:00')).toBeVisible();
    expect(screen.getByText('Leaves KUL')).toBeVisible();
    expect(screen.getByText('Arrives NRT')).toBeVisible();
    expect(screen.getByText('Seats & price unconfirmed.')).toBeVisible();
    expect(screen.getByText('Limited risk data')).toBeVisible();
    expect(screen.queryByText('Low risk')).not.toBeInTheDocument();
  });

  it('orders routes by rank and shows a transfer reminder without opening details', () => {
    render(<AlternativesList items={[{ ...option, rank: 2, option_id: 'alt-2', connections: 1, route_summary: 'KUL -> SIN -> NRT' }, option]} />);
    expect(screen.getAllByRole('heading')[0]).toHaveTextContent('KUL → NRT');
    expect(screen.getByText('Confirm transfer, baggage and entry rules.')).toBeVisible();
  });

  it.each([
    ['unavailable', 'Routes could not be checked.'],
    ['no_results', 'No suitable route found'],
    ['not_needed', 'No backup route needed'],
  ] as const)('distinguishes %s from a successful search', (status, text) => {
    render(<AlternativesList items={[]} search={{ status }} />);
    expect(screen.getByText((content) => content.startsWith(text))).toBeInTheDocument();
    expect(screen.queryByText('Top match')).not.toBeInTheDocument();
  });
});
