import { describe, it, expect } from 'vitest';
import type { AnalyticsEvent } from '@/domain/analytics';
import { getDailySeries } from './insights';

const NOW = '2026-06-07T12:00:00.000Z';

function ev(eventType: AnalyticsEvent['eventType'], daysAgo: number, merchantId = 'm1'): AnalyticsEvent {
  const createdAt = new Date(Date.parse(NOW) - daysAgo * 86_400_000).toISOString();
  return {
    id: `${eventType}-${daysAgo}`, merchantId, customerId: 'c1', sessionId: null, eventType,
    eventSource: null, styleId: null, bookingId: null, technicianId: null, query: null,
    rankPosition: null, algorithmVersion: null, metadata: {}, createdAt,
  };
}

describe('getDailySeries', () => {
  it('returns one zero-filled point per day, oldest → newest', () => {
    const series = getDailySeries([], 'm1', 7, NOW);
    expect(series).toHaveLength(7);
    expect(series.every((p) => p.tryOns === 0 && p.bookings === 0 && p.searches === 0)).toBe(true);
    expect(series[0].date < series[6].date).toBe(true);
    expect(series[6].date).toBe('2026-06-07');
  });

  it('buckets events into the right day and metric', () => {
    const events = [ev('try_on_completed', 0), ev('try_on_completed', 0), ev('booking_confirmed', 1), ev('search_submitted', 2)];
    const series = getDailySeries(events, 'm1', 7, NOW);
    const byDate = Object.fromEntries(series.map((p) => [p.date, p]));
    expect(byDate['2026-06-07'].tryOns).toBe(2);
    expect(byDate['2026-06-06'].bookings).toBe(1);
    expect(byDate['2026-06-05'].searches).toBe(1);
  });

  it('ignores other merchants and events outside the window', () => {
    const events = [ev('try_on_completed', 0, 'other'), ev('booking_confirmed', 30)];
    const series = getDailySeries(events, 'm1', 7, NOW);
    expect(series.reduce((n, p) => n + p.tryOns + p.bookings, 0)).toBe(0);
  });
});
