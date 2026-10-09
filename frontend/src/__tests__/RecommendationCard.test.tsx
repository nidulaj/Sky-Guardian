import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecommendationCard from '@/components/journey/RecommendationCard';
import type { RecoveryPlan } from '@/types/journey';

const plan: RecoveryPlan = {
  headline: 'Your connection at KUL is likely missed',
  what_happened: 'Your flight UL001 from CMB to KUL is currently delayed by 90 minutes.',
  impact: 'Your connection is classified as **LIKELY MISSED**.',
  recommended_action: 'No feasible alternative was verified. Ask SriLankan Airlines for current rebooking options.',
  why_this_option: '',
  next_steps: ['Proceed to the SriLankan Airlines transit transfer desk upon arrival at KUL.', 'Present your boarding pass.'],
  policy_citations: ['P2'],
  uncertainty: ['Some policy text shown is not verified as the airline\'s official wording.'],
  contact: 'SriLankan Airlines',
};

const evidence = [
  { title: 'Unrelated', airline: 'Other' },
  { title: 'Connection Protection', airline: 'SriLankan Airlines' },
];

describe('RecommendationCard', () => {
  it('labels a template plan as a standard summary and renders every part', () => {
    render(<RecommendationCard plan={plan} mode="template" fallbackText="unused" policyEvidence={evidence} />);
    expect(screen.getByText('Standard summary')).toBeInTheDocument();
    expect(screen.queryByText('AI-assisted explanation')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: plan.headline })).toBeInTheDocument();
    expect(screen.getByText('LIKELY MISSED').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText(/not verified as the airline/)).toBeInTheDocument();
    expect(screen.getByText('SriLankan Airlines', { selector: 'p' })).toBeInTheDocument();
  });

  it('labels a validated LLM plan as AI-assisted', () => {
    render(<RecommendationCard plan={plan} mode="llm" fallbackText="unused" policyEvidence={evidence} />);
    expect(screen.getByText('AI-assisted explanation')).toBeInTheDocument();
  });

  it('links citations to the matching policy card', () => {
    render(<RecommendationCard plan={plan} mode="llm" fallbackText="unused" policyEvidence={evidence} />);
    const link = screen.getByRole('link', { name: '[P2]' });
    expect(link).toHaveAttribute('href', '#policy-P2');
    expect(link.parentElement).toHaveTextContent('[P2] Connection Protection (SriLankan Airlines)');
  });

  it('falls back to the plain recommendation text without a plan', () => {
    render(<RecommendationCard plan={null} fallbackText={'**Heads up**\n\nCheck with your airline.'} />);
    expect(screen.getByText('Standard summary')).toBeInTheDocument();
    expect(screen.getByText('Heads up').tagName).toBe('STRONG');
    expect(screen.getByText('Check with your airline.')).toBeInTheDocument();
  });
});
