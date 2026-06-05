import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { mockBookings } from '@/mock/bookings';
import { resetRepositoriesForTests } from '@/lib/repositories';
import { createBookingAction } from '@/lib/actions/booking-actions';
import { demoCustomerName } from '@/mock/operations-store';
import MerchantBookingDetailPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/booking/booking-001'
}));

describe('MerchantBookingDetailPage', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('renders merchant booking detail read from the booking service', async () => {
    const price = mockBookings.find((b) => b.id === 'booking-001')?.quote.price ?? 0;

    render(await MerchantBookingDetailPage({ params: Promise.resolve({ id: 'booking-001' }) }));

    expect(await screen.findByRole('heading', { name: /melissa tan/i })).toBeInTheDocument();
    expect(screen.getByText(/rose cat eye shine/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`sgd ${price}`, 'i'))).toBeInTheDocument();
    expect(screen.getByText(/prefer a softer pink tone/i)).toBeInTheDocument();
    expect(screen.getByText(/technician: mei chen/i)).toBeInTheDocument();
    expect(screen.getByText(/status: pending review/i)).toBeInTheDocument();
    // conversationId comes from the seeded thread linked to booking-001.
    expect(screen.getByRole('link', { name: /open message thread/i })).toHaveAttribute(
      'href',
      '/merchant/messages/conv-melissa'
    );
  });

  it('renders a newly created booking by id', async () => {
    const booking = await createBookingAction({
      technicianId: 'tech-anna',
      customerName: demoCustomerName,
      styleTitle: 'Custom AI reference',
      styleImageUrl: '',
      date: '2026-05-23',
      time: '10:00',
      estimate: { price: 123, duration: 88 },
      status: 'confirmed',
      notes: 'Created from customer confirmation.'
    });

    render(await MerchantBookingDetailPage({ params: Promise.resolve({ id: booking.id }) }));

    expect(await screen.findByRole('heading', { name: /melissa tan/i })).toBeInTheDocument();
    expect(screen.getByText(/technician: anna lim/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open message thread/i })).toHaveAttribute(
      'href',
      `/merchant/messages/${booking.conversationId}`
    );
  });
});
