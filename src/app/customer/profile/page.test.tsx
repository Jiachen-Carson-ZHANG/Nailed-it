import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import CustomerProfilePage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/profile'
}));

describe('CustomerProfilePage', () => {
  it('renders customer profile summary and booking history from shared bookings', () => {
    render(<CustomerProfilePage />);

    expect(screen.getByRole('heading', { name: /melissa tan/i })).toBeInTheDocument();
    expect(screen.getByText(/upcoming bookings/i)).toBeInTheDocument();
    expect(screen.getByText(/rose cat eye shine/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start a new booking/i })).toHaveAttribute(
      'href',
      '/customer/booking'
    );
  });
});
