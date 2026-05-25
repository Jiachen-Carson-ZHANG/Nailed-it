import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import type { CustomerBookingDraft } from '@/domain/nail';
import { mockAIResult } from '@/mock/ai';
import {
  createBookingFromDraft,
  getAvailableBookingDays,
  getBookingsSnapshot,
  resetOperationsStoreForTests
} from '@/mock/operations-store';
import MerchantBookingDetailPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/booking/booking-001'
}));

describe('MerchantBookingDetailPage', () => {
  beforeEach(() => {
    resetOperationsStoreForTests();
  });

  it('renders merchant booking detail from the shared booking source of truth', async () => {
    const booking = getBookingsSnapshot().find((item) => item.id === 'booking-001');

    render(await MerchantBookingDetailPage({ params: Promise.resolve({ id: 'booking-001' }) }));

    expect(
      screen.getByRole('heading', {
        name: /melissa tan/i
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/rose cat eye shine/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`sgd ${booking?.quote.price ?? ''}`, 'i'))).toBeInTheDocument();
    expect(screen.getByText(/prefer a softer pink tone/i)).toBeInTheDocument();
    expect(screen.getByText(/technician: mei chen/i)).toBeInTheDocument();
    expect(screen.getByText(/status: pending_review/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open message thread/i })).toHaveAttribute(
      'href',
      '/merchant/messages/conv-melissa'
    );
  });

  it('renders newly created session bookings by id', async () => {
    const slot = getAvailableBookingDays()[0].slots[0];
    const booking = createBookingFromDraft({
      draft: baseDraft,
      notes: 'Created from customer confirmation.',
      slot
    });

    render(await MerchantBookingDetailPage({ params: Promise.resolve({ id: booking.id }) }));

    expect(screen.getByRole('heading', { name: /melissa tan/i })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`technician: ${booking.technician.name}`, 'i'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open message thread/i })).toHaveAttribute(
      'href',
      `/merchant/messages/${booking.conversationId}`
    );
  });
});

const baseDraft: CustomerBookingDraft = {
  estimate: {
    source: 'pricing_rules',
    price: 123,
    duration: 88
  },
  imageUrl: 'https://example.com/reference.png',
  recognition: mockAIResult
};
