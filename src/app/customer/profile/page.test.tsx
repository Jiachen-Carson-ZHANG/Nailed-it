import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { resetRepositoriesForTests } from '@/lib/repositories';
import { createBookingAction } from '@/lib/actions/booking-actions';
import { demoCustomerName } from '@/mock/operations-store';
import CustomerProfilePage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/profile'
}));

describe('CustomerProfilePage', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('renders the customer profile and booking history read from the booking service', async () => {
    render(<CustomerProfilePage />);

    // identity is static; the history loads from the booking service.
    expect(screen.getByRole('heading', { name: /melissa tan/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /booking history/i })).toBeInTheDocument();
    expect(await screen.findByText(/rose cat eye shine/i)).toBeInTheDocument();
    expect(screen.getByText(/awaiting confirmation/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
  });

  it('includes a booking created for the demo customer through the booking service', async () => {
    await createBookingAction({
      technicianId: 'tech-anna',
      customerName: demoCustomerName,
      styleTitle: 'Custom AI reference',
      styleImageUrl: '',
      date: '2026-05-23',
      time: '10:00',
      estimate: { price: 123, duration: 88 },
      status: 'confirmed',
      notes: 'Profile should show this booking.'
    });

    render(<CustomerProfilePage />);

    expect(await screen.findByText(/profile should show this booking/i)).toBeInTheDocument();
  });
});
