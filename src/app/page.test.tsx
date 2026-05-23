import { render, screen } from '@testing-library/react';
import LandingPage from './page';

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
    ).toHaveAttribute('href', '/customer/home');
    expect(
      screen.getByRole('link', {
        name: /merchant manage prices and bookings/i
      })
    ).toHaveAttribute('href', '/merchant/calendar');
  });
});
