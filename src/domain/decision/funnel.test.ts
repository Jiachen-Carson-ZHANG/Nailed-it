import { describe, expect, it } from 'vitest';
import { computeFunnelScores, type FunnelCounts } from './funnel';

const empty: FunnelCounts = {
  impressions: 0, clicks: 0, detailViews: 0, saves: 0, tryOns: 0, bookings: 0, completedOrders: 0,
};

describe('computeFunnelScores', () => {
  it('is divide-by-zero safe (no data → all zero)', () => {
    const s = computeFunnelScores(empty);
    expect(s.rates.ctr).toBe(0);
    expect(s.demandScore).toBe(0);
    expect(s.conversionScore).toBe(0);
  });

  it('caps a sub-score at 100 when a rate meets or beats its target', () => {
    // clicks/impressions = 1.0 >> ctr target 0.08 → CTR sub-score capped at 100 (25% weight = 25 pts).
    const s = computeFunnelScores({ ...empty, impressions: 100, clicks: 100 });
    expect(s.rates.ctr).toBe(1);
    expect(s.demandScore).toBe(25); // only the CTR term is non-zero, capped
  });

  it('separates "high interest, low conversion" — the PM coupon signal', () => {
    // Lots of clicks/saves/try-ons but few bookings → high demand, low conversion.
    const interested = computeFunnelScores({
      impressions: 1000, clicks: 120, detailViews: 100, saves: 40, tryOns: 45, bookings: 3, completedOrders: 3,
    });
    expect(interested.demandScore).toBeGreaterThan(60);
    expect(interested.conversionScore).toBeLessThan(40);
  });

  it('folds a supplied search-demand-match score into demand', () => {
    const withSearch = computeFunnelScores({ ...empty, searchDemandMatchScore: 100 });
    expect(withSearch.demandScore).toBe(15); // 15% weight, others zero
  });
});
