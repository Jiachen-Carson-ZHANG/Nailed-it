import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { mockAIResult } from '@/mock/ai';
import {
  createBookingFromDraft,
  getAvailableBookingDays,
  resetOperationsStoreForTests
} from '@/mock/operations-store';
import CustomerProfilePage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/profile'
}));

describe('CustomerProfilePage', () => {
  beforeEach(() => {
    resetOperationsStoreForTests();
  });

  it('renders customer profile summary and booking history from shared bookings', () => {
    render(<CustomerProfilePage />);

    expect(screen.getByRole('heading', { name: /melissa tan/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /booking history/i })).toBeInTheDocument();
    expect(screen.getByText(/upcoming bookings/i)).toBeInTheDocument();
    expect(screen.getByText(/rose cat eye shine/i)).toBeInTheDocument();
    expect(screen.getByText(/awaiting confirmation/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy'
    );
  });

  it('includes the latest booking created in the current session', () => {
    const slot = getAvailableBookingDays()[0].slots[0];
    createBookingFromDraft({
      draft: {
        estimate: { source: 'pricing_rules', price: 123, duration: 88 },
        imageUrl: 'https://example.com/reference.png',
        recognition: mockAIResult
      },
      notes: 'Profile should show this booking.',
      slot
    });

    render(<CustomerProfilePage />);

    expect(screen.getByText(/profile should show this booking/i)).toBeInTheDocument();
  });
});
