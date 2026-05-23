import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { mockBookings } from '@/mock/bookings';
import MerchantBookingDetailPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/booking/booking-001'
}));

describe('MerchantBookingDetailPage', () => {
  it('renders merchant booking detail from the shared booking source of truth', async () => {
    const booking = mockBookings.find((item) => item.id === 'booking-001');

    render(await MerchantBookingDetailPage({ params: Promise.resolve({ id: 'booking-001' }) }));

    expect(
      screen.getByRole('heading', {
        name: /melissa tan/i
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/rose cat eye shine/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`sgd ${booking?.quote.price ?? ''}`, 'i'))).toBeInTheDocument();
    expect(screen.getByText(/prefer a softer pink tone/i)).toBeInTheDocument();
  });
});
