import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import type { CustomerBookingDraft } from '@/domain/nail';
import { mockAIResult } from '@/mock/ai';
import {
  createBookingFromDraft,
  getAvailableBookingDays,
  resetOperationsStoreForTests
} from '@/mock/operations-store';
import MerchantCalendarPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/calendar'
}));

describe('MerchantCalendarPage', () => {
  beforeEach(() => {
    resetOperationsStoreForTests();
  });

  it('renders the spots-left month and shows the selected day schedule as booking links', async () => {
    render(<MerchantCalendarPage />);

    expect(
      screen.getByRole('heading', {
        name: /appointment calendar/i
      })
    ).toBeInTheDocument();

    // Default selected day is 2026-05-23, which has two seeded bookings.
    expect(screen.getByRole('button', { name: /23 May, \d+ spots left/i })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /14:00 · melissa tan/i })).toHaveAttribute(
      'href',
      '/merchant/booking/booking-001'
    );
  });

  it('switches the day schedule when another day is selected', async () => {
    const user = userEvent.setup();

    render(<MerchantCalendarPage />);

    // 2026-05-24 holds booking-003 (Zoe Wong, 11:00).
    await user.click(screen.getByRole('button', { name: /24 May, \d+ spots left/i }));

    expect(screen.getByRole('link', { name: /11:00 · zoe wong/i })).toHaveAttribute(
      'href',
      '/merchant/booking/booking-003'
    );
  });

  it('shows newly created session bookings on the selected day', async () => {
    const slot = getAvailableBookingDays()[0].slots[0];
    const booking = createBookingFromDraft({
      draft: baseDraft,
      notes: 'Created from customer confirmation.',
      slot
    });

    render(<MerchantCalendarPage />);

    // Newly created booking lands on 2026-05-23 (the default selected day).
    expect(
      screen.getByRole('link', { name: new RegExp(`${slot.time} · melissa tan`, 'i') })
    ).toHaveAttribute('href', `/merchant/booking/${booking.id}`);
  });
});

const baseDraft: CustomerBookingDraft = {
  estimate: {
    source: 'pricing_rules',
    price: 123,
    duration: 88
  },
  imageUrl: 'https://example.com/reference.png',
  recognition: mockAIResult
};
