import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import AgentWorkflowProgress, { AGENTS, CHECKS } from '@/components/journey/AgentWorkflowProgress';

describe('Journey loading message', () => {
  it('shows the four agents in order without pretending to show results', () => {
    render(<AgentWorkflowProgress />);
    expect(screen.getByRole('heading', { name: /Checking your journey/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your journey.');
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items.map((li) => li.textContent)).toEqual(AGENTS.map((a) => expect.stringContaining(a.name)));
    expect(document.body.textContent).not.toMatch(/weighted|supervisor/i);
  });

  it('keeps a readable name for every workflow trace id', () => {
    expect(CHECKS.map((c) => c.id)).toEqual([
      'flight_agent', 'connection_agent', 'weather_agent', 'risk_agent', 'policy_agent', 'alternative_agent', 'recovery_agent',
    ]);
  });
});
