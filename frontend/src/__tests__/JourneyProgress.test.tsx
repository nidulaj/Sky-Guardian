import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AgentWorkflowProgress from '@/components/journey/AgentWorkflowProgress';

describe('Journey loading message', () => {
  it('shows one short status without agent names or a pretend step-by-step trace', () => {
    render(<AgentWorkflowProgress />);
    expect(screen.getByRole('heading', { name: 'Checking your journey...' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Checking flight times, connections and weather.');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bagents?\b|weighted|supervisor/i);
  });
});
