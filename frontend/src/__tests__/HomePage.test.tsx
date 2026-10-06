import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import LandingPage from '@/app/page';
import { mockWeatherBackend } from '@/test/weatherFixtures';

describe('Home page Weather Agent integration', () => {
  it('renders the Weather Agent section alongside the existing sections', async () => {
    mockWeatherBackend();
    render(<LandingPage />);

    // Existing sections are still present.
    expect(screen.getByRole('heading', { name: /Seven specialists/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /A score you can/ })).toBeInTheDocument();

    // New live Weather Agent section, defaulting to CMB.
    expect(screen.getByRole('heading', { name: /Airport weather, scored hourly/ })).toBeInTheDocument();
    const card = screen.getByTestId('weather-agent-card');
    expect(within(card).getByText('WEATHER AGENT')).toBeInTheDocument();
    expect(await within(card).findByTestId('weather-condition')).toHaveTextContent('Moderate rain');
    expect(within(card).getByTestId('weather-risk-score')).toHaveTextContent('45/100');
  });

  it('keeps the page working when the weather service is down', async () => {
    mockWeatherBackend(() => ({ status: 503, body: {} }));
    render(<LandingPage />);
    expect(await screen.findByText('Weather data temporarily unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /A score you can/ })).toBeInTheDocument();
  });
});
