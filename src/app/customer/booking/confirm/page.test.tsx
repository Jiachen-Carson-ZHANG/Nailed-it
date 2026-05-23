import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CustomerBookingConfirmPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/booking/confirm'
}));

describe('CustomerBookingConfirmPage', () => {
  it('lets the customer pick a slot and confirm the appointment with a toast', async () => {
    const user = userEvent.setup();

    render(<CustomerBookingConfirmPage />);

    const confirmButton = screen.getByRole('button', { name: /confirm appointment/i });
    expect(confirmButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '10:00' }));
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(screen.getByRole('status')).toHaveTextContent(/booking request sent to merchant for today at 10:00/i);
  });
});
