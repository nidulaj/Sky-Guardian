import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import LandingPage from '@/app/page';
import { mockWeatherBackend } from '@/test/weatherFixtures';
import { AuthProvider } from '@/lib/auth/AuthContext';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

describe('Home page airport weather', () => {
  it('keeps weather and risk guidance without the agent showcase or technical labels', async () => {
    mockWeatherBackend();
    render(<AuthProvider><LandingPage /></AuthProvider>);

    expect(screen.queryByRole('heading', { name: /Seven specialists/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /What your risk means/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bagents?\b|deterministic|supervisor|Risk engine/i);
    expect(screen.queryByRole('link', { name: 'The agents' })).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /Airport weather, at a glance/ })).toBeInTheDocument();
    const card = screen.getByTestId('weather-agent-card');
    expect(within(card).getByText('Airport weather')).toBeInTheDocument();
    expect(await within(card).findByTestId('weather-condition')).toHaveTextContent('Moderate rain');
    expect(within(card).getByTestId('weather-risk-score')).toHaveTextContent('45/100');
  });

  it('keeps the page working when the weather service is down', async () => {
    mockWeatherBackend(() => ({ status: 503, body: {} }));
    render(<AuthProvider><LandingPage /></AuthProvider>);
    expect(await screen.findByText('Weather data temporarily unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /What your risk means/ })).toBeInTheDocument();
  });
});
