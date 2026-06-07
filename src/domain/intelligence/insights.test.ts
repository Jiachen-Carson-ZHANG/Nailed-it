import { describe, it, expect } from 'vitest';
import type { AnalyticsEvent } from '@/domain/analytics';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import { getMerchantInsights } from './insights';

const NOW = '2026-06-07T00:00:00.000Z';
const CUR = '2026-06-05T00:00:00.000Z'; // in the current 7-day window
const PREV = '2026-05-27T00:00:00.000Z'; // in the previous 7-day window

const f = (label: string): StyleDiscoveryFacet => ({ kind: 'style', label });
// Published set: 暗黑 on exactly 1 style (the honest gap), 甜美 on 2 (saturated → never a gap),
// 金属感 on the low-conversion anchor.
const styles = [
  { id: 'darkOnly', title: '暗黑款', discoveryFacets: [f('暗黑')] },
  { id: 'sweet1', title: '甜美一', discoveryFacets: [f('甜美')] },
  { id: 'sweet2', title: '甜美二', discoveryFacets: [f('甜美')] },
  { id: 'lc1', title: '金属低转化', discoveryFacets: [f('金属感')] },
];

let seq = 0;
function ev(o: Partial<AnalyticsEvent> & { eventType: AnalyticsEvent['eventType'] }): AnalyticsEvent {
  seq += 1;
  return {
    id: `e-${seq}`,
    merchantId: 'm1',
    customerId: 'c1',
    sessionId: null,
    eventSource: null,
    styleId: null,
    bookingId: null,
    technicianId: null,
    query: null,
    rankPosition: null,
    algorithmVersion: null,
    metadata: {},
    createdAt: CUR,
    ...o,
  };
}
const repeat = (n: number, make: () => AnalyticsEvent) => Array.from({ length: n }, make);

const events: AnalyticsEvent[] = [
  ...repeat(10, () => ev({ eventType: 'try_on_completed', styleId: 'lc1' })),
  ev({ eventType: 'booking_confirmed', styleId: 'lc1', metadata: { price: 60 } }),
  ...repeat(12, () => ev({ eventType: 'search_submitted', query: '暗黑' })),
  ...repeat(12, () => ev({ eventType: 'search_submitted', query: '甜美' })),
  ...repeat(2, () => ev({ eventType: 'try_on_completed', styleId: 'lc1', createdAt: PREV })),
  ev({ eventType: 'style_save', styleId: 'darkOnly', merchantId: 'other-merchant' }), // ignored: other merchant
];

describe('getMerchantInsights', () => {
  const insights = getMerchantInsights(events, styles, 'm1', { days: 7 }, NOW);

  it('counts the current-window snapshot, scoped to the merchant', () => {
    expect(insights.snapshot).toMatchObject({
      rangeDays: 7,
      tryOns: 10,
      bookings: 1,
      searches: 24,
      activeCustomers: 1,
    });
  });

  it('reports demand trends this period vs the previous period', () => {
    const metallic = insights.demandTrends.find((t) => t.label === '金属感');
    expect(metallic).toMatchObject({ current: 11, previous: 2, direction: 'up' });
    expect(insights.demandTrends.find((t) => t.label === '暗黑')?.current).toBe(12);
  });

  it('flags the high-interest / low-conversion style', () => {
    const flagged = insights.designPerformance.highInterestLowConversion.map((s) => s.styleId);
    expect(flagged).toContain('lc1');
    const lc1 = insights.designPerformance.styles.find((s) => s.styleId === 'lc1');
    expect(lc1).toMatchObject({ tryOns: 12, bookings: 1 });
    expect(lc1?.conversionRate).toBeCloseTo(0.08);
  });

  it('surfaces the honest catalog gap and ignores the saturated tag', () => {
    expect(insights.catalogGaps).toHaveLength(1);
    expect(insights.catalogGaps[0]).toMatchObject({ label: '暗黑', matchingActiveStyles: 1, searchCount: 12 });
    // 甜美 has 12 searches too, but 2 published styles match → not a gap.
    expect(insights.catalogGaps.some((g) => g.label === '甜美')).toBe(false);
  });
});
