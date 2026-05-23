import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from './page';

vi.mock('@/domain/session', () => ({
  homePathForRole: (role: 'customer' | 'merchant') =>
    role === 'customer' ? '/mock-customer-home' : '/mock-merchant-calendar'
}));

describe('LandingPage', () => {
  it('renders the landing shell with both role entry points', () => {
    render(<LandingPage />);

    expect(
      screen.getByRole('heading', {
        name: 'Nailed-it'
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: /customer find styles and book/i
      })
    ).toHaveAttribute('href', '/mock-customer-home');
    expect(
      screen.getByRole('link', {
        name: /merchant manage prices and bookings/i
      })
    ).toHaveAttribute('href', '/mock-merchant-calendar');
  });
});
