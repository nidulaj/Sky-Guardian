import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/(dashboard)/dashboard/page';
import DashboardLayout from '@/app/(dashboard)/layout';
import * as AuthModule from '@/lib/auth/AuthContext';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock, prefetch: vi.fn() }),
  usePathname: () => '/dashboard',
}));

describe('Dashboard Security Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks unauthenticated visitors and displays Passenger Sign-In Required', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
      isPassenger: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<DashboardPage />);

    expect(screen.getByText('Passenger Sign-In Required')).toBeInTheDocument();
    expect(screen.getByText(/You must be signed in with a registered passenger account/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sign in as Passenger/i })).toHaveAttribute(
      'href',
      '/login?redirect=/dashboard'
    );
    expect(replaceMock).toHaveBeenCalledWith('/login?redirect=/dashboard');
  });

  it('shows security verification spinner while checking credentials', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
      isPassenger: false,
      isLoading: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<DashboardPage />);

    expect(screen.getByText('Verifying passenger credentials...')).toBeInTheDocument();
    expect(screen.queryByText('Passenger Sign-In Required')).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('DashboardLayout protects all child pages from unauthenticated access', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
      isPassenger: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <DashboardLayout>
        <div data-testid="protected-content">Secret Content</div>
      </DashboardLayout>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByText('Passenger Sign-In Required')).toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith('/login?redirect=%2Fdashboard');
  });
});
