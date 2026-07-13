import { describe, expect, it } from 'vitest';
import { bookingsToBusyIntervals, funnelCountsByStyle } from './aggregate';
import type { AnalyticsEvent } from '../analytics';
import type { CapacityDay } from './capacity';
import type { Weekday } from '../scheduling';

const ev = (eventType: AnalyticsEvent['eventType'], styleId: string | null, bookingId: string | null = null): AnalyticsEvent => ({
  id: 'e', merchantId: 'm', customerId: 'c', sessionId: 's', eventType, eventSource: null,
  styleId, bookingId, technicianId: null, query: null, rankPosition: null, algorithmVersion: null,
  metadata: {}, createdAt: '2026-07-06T00:00:00Z',
});

describe('funnelCountsByStyle', () => {
  it('buckets events per style and counts completions from the completed-booking set', () => {
    const events = [
      ev('style_impression', 'A'), ev('style_card_click', 'A'), ev('style_detail_view', 'A'),
      ev('booking_confirmed', 'A', 'bk-1'), ev('booking_confirmed', 'A', 'bk-2'),
      ev('style_card_click', 'B'), ev('recommended_style_sent', 'A'), ev('style_save', null),
    ];
    const counts = funnelCountsByStyle(events, new Set(['bk-1'])); // only bk-1 completed
    const a = counts.get('A')!;
    expect(a.impressions).toBe(1);
    expect(a.clicks).toBe(1);
    expect(a.bookings).toBe(2);
    expect(a.completedOrders).toBe(1); // bk-2 booked but not completed
    expect(counts.get('B')!.clicks).toBe(1);
    expect(counts.has('null')).toBe(false); // null styleId ignored
  });
});

describe('bookingsToBusyIntervals', () => {
  const days: CapacityDay[] = [{ date: '2026-07-06', weekday: 1 as Weekday }];
  it('maps in-window non-cancelled bookings to local-minute intervals', () => {
    const bookings = [
      { date: '2026-07-06', time: '13:00', status: 'confirmed', quote: { duration: 90 }, technician: { id: 't1' } },
      { date: '2026-07-06', time: '10:00', status: 'cancelled', quote: { duration: 60 }, technician: { id: 't1' } },
      { date: '2026-07-09', time: '10:00', status: 'confirmed', quote: { duration: 60 }, technician: { id: 't1' } }, // out of window
    ];
    const busy = bookingsToBusyIntervals(bookings, days);
    expect(busy).toEqual([{ technicianId: 't1', date: '2026-07-06', startMin: 780, endMin: 870 }]);
  });
});
