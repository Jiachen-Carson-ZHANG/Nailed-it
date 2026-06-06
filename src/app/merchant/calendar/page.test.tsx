import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import { resetRepositoriesForTests } from '@/lib/repositories';
import { createBookingAction } from '@/lib/actions/booking-actions';
import { mockAIResult } from '@/mock/ai';
import MerchantCalendarPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/calendar'
}));

describe('MerchantCalendarPage', () => {
  beforeEach(() => {
    // The calendar now reads bookings from the repository-backed booking service; reset the
    // in-memory bundle so each test starts from the derived demo seed (booking-001..004).
    resetRepositoriesForTests();
  });

  it('renders the seeded day schedule as booking links (read from the booking service)', async () => {
    render(<MerchantCalendarPage />);

    expect(
      screen.getByRole('heading', { name: /appointment calendar/i })
    ).toBeInTheDocument();

    // Default selected day is 2026-05-23; booking-001 is Melissa at 14:00 (async load).
    expect(
      await screen.findByRole('link', { name: /14:00 · melissa tan/i })
    ).toHaveAttribute('href', '/merchant/booking/booking-001');
  });

  it('switches the day schedule when another day is selected', async () => {
    const user = userEvent.setup();
    render(<MerchantCalendarPage />);

    // wait for the data, then switch to 2026-05-24 (booking-003 Zoe Wong, 11:00).
    await user.click(await screen.findByRole('button', { name: /24 May, \d+ spots left/i }));

    expect(screen.getByRole('link', { name: /11:00 · zoe wong/i })).toHaveAttribute(
      'href',
      '/merchant/booking/booking-003'
    );
  });

  it('shows a newly created booking once it is written through the booking service', async () => {
    // tech-anna is free on 2026-05-23 (her seed booking is on 05-24). Identity is server-derived
    // to the demo customer (Melissa Tan).
    await createBookingAction({
      technicianId: 'tech-anna',
      recognition: mockAIResult,
      styleTitle: 'Custom AI reference',
      styleImageUrl: '',
      date: '2026-05-23',
      time: '10:00',
      notes: 'from confirm flow'
    });

    render(<MerchantCalendarPage />);

    expect(
      await screen.findByRole('link', { name: /10:00 · melissa tan/i })
    ).toBeInTheDocument();
  });
});
