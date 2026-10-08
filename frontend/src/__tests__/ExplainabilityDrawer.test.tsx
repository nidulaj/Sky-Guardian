import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ExplainabilityDrawer from '@/components/journey/ExplainabilityDrawer';
import type { AgentRun } from '@/types/journey';

const trace: AgentRun[] = [
  { agent: 'flight_agent', status: 'success', warnings: [], duration_ms: 1200 },
  { agent: 'weather_agent', status: 'error', warnings: ['Weather data unavailable; risk assessed with reduced confidence.'], duration_ms: 30, error: 'weather agent RuntimeError' },
  { agent: 'policy_agent', status: 'skipped', warnings: [] },
];

function open(props: Partial<React.ComponentProps<typeof ExplainabilityDrawer>> = {}) {
  return render(<ExplainabilityDrawer isOpen onClose={() => {}} {...props} />);
}

describe('ExplainabilityDrawer workflow trace', () => {
  it('lists each agent with its public status, timing and warnings', () => {
    open({ workflowTrace: trace });
    const section = screen.getByRole('heading', { name: /How the agents ran/ }).parentElement!;
    expect(within(section).getByText('Flight agent')).toBeInTheDocument();
    expect(within(section).getByText(/1\.2 s/)).toBeInTheDocument();
    expect(within(section).getByText('Could not run')).toBeInTheDocument();
    expect(within(section).getByText(/risk assessed with reduced confidence/)).toBeInTheDocument();
    expect(within(section).getByText('Not needed')).toBeInTheDocument();
    // Internal error details stay out of the passenger view.
    expect(screen.queryByText(/RuntimeError/)).not.toBeInTheDocument();
  });

  it('explains why recovery options were checked', () => {
    open({ recoveryReasons: ['CONNECTION_AT_RISK', 'PASSENGER_REQUESTED'] });
    expect(screen.getByText('A connection is at risk of being missed.')).toBeInTheDocument();
    expect(screen.getByText('You asked to see alternative flights.')).toBeInTheDocument();
  });

  it('hides both sections when the response has no trace', () => {
    open();
    expect(screen.queryByRole('heading', { name: /How the agents ran/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Why recovery/ })).not.toBeInTheDocument();
  });

  it('marks unverified sources', () => {
    open({ sources: [{ name: 'Demo policy', type: 'Policy Document', verified: false }, { name: 'Open-Meteo', type: 'Weather Forecast', verified: true }] });
    expect(screen.getByText('Policy Document · Not verified')).toBeInTheDocument();
    expect(screen.getByText('Weather Forecast')).toBeInTheDocument();
  });
});
