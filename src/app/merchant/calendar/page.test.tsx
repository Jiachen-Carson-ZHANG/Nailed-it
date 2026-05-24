import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import MerchantCalendarPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/calendar'
}));

describe('MerchantCalendarPage', () => {
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
  });
});
