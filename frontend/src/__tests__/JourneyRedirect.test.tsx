import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NewJourneyPage from '@/app/(dashboard)/journeys/new/page';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect, useRouter: () => ({ push: vi.fn() }), usePathname: () => '/journeys/new' }));

describe('Journey page URL', () => {
  it('keeps /journeys/new as a full journey check page next to the dashboard check', () => {
    render(<NewJourneyPage />);
    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /Will you make your/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Likely missed connection/ })).toBeInTheDocument();
  });
});
