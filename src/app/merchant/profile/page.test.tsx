import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { resetRepositoriesForTests } from '@/lib/repositories';
import MerchantProfilePage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/profile'
}));

describe('MerchantProfilePage', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('renders merchant analytics and management shortcuts (workload read from the DB)', async () => {
    render(<MerchantProfilePage />);

    expect(screen.getByRole('heading', { name: /studio profile/i })).toBeInTheDocument();
    expect(screen.getByText(/appointments this week/i)).toBeInTheDocument();
    expect(screen.getByText(/technician workload/i)).toBeInTheDocument();
    expect(screen.getByText('Mei Chen')).toBeInTheDocument();
    // Mei has booking-001 + booking-004 (both pending_review) in the seed → 2 active (async load).
    expect(await screen.findByText(/2 active bookings/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open pricing rules/i })).toHaveAttribute(
      'href',
      '/merchant/manage'
    );
    expect(screen.getByRole('link', { name: /manage collection/i })).toHaveAttribute('href', '/merchant/styles');
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy'
    );
  });
});
