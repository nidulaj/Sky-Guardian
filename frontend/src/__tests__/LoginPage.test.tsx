import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';

const { login, push } = vi.hoisted(() => ({ login: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/auth/AuthContext', () => ({ useAuth: () => ({ login }) }));

beforeEach(() => vi.clearAllMocks());

function signIn() {
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'passenger@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('Sign-in destination', () => {
  it('opens the normal journey form for passengers', async () => {
    login.mockResolvedValue({ role: 'PASSENGER' });
    signIn();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/journeys/new'));
  });

  it('keeps the admin destination unchanged', async () => {
    login.mockResolvedValue({ role: 'ADMIN' });
    signIn();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin'));
  });

  it('does not navigate when sign-in fails', async () => {
    login.mockRejectedValue(new Error('Invalid credentials.'));
    signIn();
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials.');
    expect(push).not.toHaveBeenCalled();
  });
});
