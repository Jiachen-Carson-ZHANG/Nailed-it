import { describe, expect, it } from 'vitest';
import type { BookingItem, IntervalBooking } from '@/domain/booking';
import { intervalBookingToUiBooking } from './booking-adapter';

const booking: IntervalBooking = {
  id: 'booking-x',
  merchantId: 'merchant-nailed-it',
  technicianId: 'tech-mei',
  customerName: 'Melissa Tan',
  styleTitle: 'Rose Cat Eye',
  styleImageUrl: 'https://example.com/x.png',
  startAt: new Date(Date.parse('2026-06-09T10:00:00+08:00')).toISOString(),
  endAt: new Date(Date.parse('2026-06-09T11:30:00+08:00')).toISOString(),
  durationMin: 90,
  status: 'confirmed',
  notes: 'soft pink',
};

const items: BookingItem[] = [
  {
    id: 'bitem-1',
    bookingId: 'booking-x',
    catalogItemId: null,
    label: 'AI style quote snapshot',
    priceCents: 5000,
    durationMin: 90,
    quantity: 1,
    pricingUnit: 'fixed',
    affectsDuration: true,
  },
];

const options = {
  timeZone: 'Asia/Singapore',
  technician: { id: 'tech-mei', name: 'Mei Chen', initials: 'MC' },
  merchantName: 'Nailed-it Studio',
  conversationId: 'conv-1',
};

describe('intervalBookingToUiBooking', () => {
  it('maps an interval booking + items back to the flat UI Booking shape', () => {
    const ui = intervalBookingToUiBooking({ booking, items }, options);
    expect(ui.date).toBe('2026-06-09');
    expect(ui.time).toBe('10:00');
    expect(ui.quote).toEqual({ source: 'booking_snapshot', price: 50, duration: 90 });
    expect(ui.technician).toEqual({ id: 'tech-mei', name: 'Mei Chen', initials: 'MC' });
    expect(ui.conversationId).toBe('conv-1');
    expect(ui.status).toBe('confirmed');
    expect(ui.styleTitle).toBe('Rose Cat Eye');
  });

  it('downgrades the interval-only in_progress status to the flat confirmed', () => {
    const ui = intervalBookingToUiBooking({ booking: { ...booking, status: 'in_progress' }, items }, options);
    expect(ui.status).toBe('confirmed');
  });

  it('sums item prices for the quote total (cents → dollars)', () => {
    const twoItems = [...items, { ...items[0], id: 'bitem-2', priceCents: 1500 }];
    const ui = intervalBookingToUiBooking({ booking, items: twoItems }, options);
    expect(ui.quote.price).toBe(65);
  });
});
