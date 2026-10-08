import { describe, expect, it, vi } from 'vitest';
import NewJourneyRedirectPage from '@/app/(dashboard)/journeys/new/page';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }) }));
vi.mock('next/navigation', () => ({ redirect }));

describe('Legacy journey URL', () => {
  it('opens the combined dashboard', () => {
    expect(() => NewJourneyRedirectPage()).toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });
});
