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

  it('renders the merchant calendar and opens a day sheet with bookings', async () => {
    const user = userEvent.setup();

    render(<MerchantCalendarPage />);

    expect(
      screen.getByRole('heading', {
        name: /appointment calendar/i
      })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /23 2 bookings/i }));

    expect(screen.getByRole('dialog', { name: /2026-05-23/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /14:00 · melissa tan/i })).toHaveAttribute(
      'href',
      '/merchant/booking/booking-001'
    );
    expect(screen.getByText(/mei chen · \d+ min · SGD/i)).toBeInTheDocument();
  });

  it('shows newly created session bookings on the calendar', async () => {
    const user = userEvent.setup();
    const slot = getAvailableBookingDays()[0].slots[0];
    const booking = createBookingFromDraft({
      draft: baseDraft,
      notes: 'Created from customer confirmation.',
      slot
    });

    render(<MerchantCalendarPage />);

    await user.click(screen.getByRole('button', { name: /23 3 bookings/i }));

    expect(screen.getByRole('link', { name: /10:00 · carson lee/i })).toHaveAttribute(
      'href',
      `/merchant/booking/${booking.id}`
    );
    expect(
      screen.getByText(new RegExp(`${booking.technician.name} .* 88 min .* SGD 123`, 'i'))
    ).toBeInTheDocument();
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
