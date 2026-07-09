import { describe, expect, it } from 'vitest';
import { computeStyleEconomics } from './economics';
import { computeFunnelScores, type FunnelCounts } from './funnel';
import { decideStyle, type DecisionContext, type StyleDecisionInput } from './decision';

const econ = computeStyleEconomics(20000, 60); // ¥200, 60min → strong profit/hour
const peers = { maxProfitPerHourCents: econ.profitPerHourCents, maxRevenuePerHourCents: econ.revenuePerHourCents, maxPriceCents: econ.priceCents };

const converting: FunnelCounts = { impressions: 1000, clicks: 100, detailViews: 80, saves: 25, tryOns: 25, bookings: 20, completedOrders: 18 };
const interestedNotConverting: FunnelCounts = { impressions: 1000, clicks: 120, detailViews: 100, saves: 40, tryOns: 45, bookings: 3, completedOrders: 3 };
const cold: FunnelCounts = { impressions: 1000, clicks: 8, detailViews: 4, saves: 1, tryOns: 1, bookings: 0, completedOrders: 0 };

const input = (funnel: FunnelCounts): StyleDecisionInput => ({
  styleId: 's', styleTitle: '款', economics: econ, funnel: computeFunnelScores(funnel), fitsCapacity: true,
});
const ctx = (utilPct: number, band: DecisionContext['capacityBand']): DecisionContext => ({
  capacityBand: band, capacityUtilizationPct: utilPct, minProfitPerHourCents: 1000,
});

describe('decideStyle — the four PM quadrants', () => {
  it('明星利润款 → ad (profitable + converting + underexposed + room to serve)', () => {
    const d = decideStyle(input(converting), ctx(60, 'normal'), peers);
    expect(d.candidate).toBe('ad');
    expect(d.scores.conversion).toBeGreaterThanOrEqual(65);
    expect(d.signals).toContain('underexposed');
  });

  it('闲时填充款 → coupon (interested-but-stuck + idle + still profitable discounted)', () => {
    const d = decideStyle(input(interestedNotConverting), ctx(55, 'very_idle'), peers);
    expect(d.candidate).toBe('coupon');
    expect(d.suggestedCouponCents).toBe(16000); // 20% off ¥200
  });

  it('展示种草款 → display_only (same interest, but next week is busy → no discount)', () => {
    const d = decideStyle(input(interestedNotConverting), ctx(82, 'near_full'), peers);
    expect(d.candidate).toBe('display_only'); // coupon gated by capacity (>70%), ad gated by conversion
  });

  it('低效款 → skip (no demand)', () => {
    const d = decideStyle(input(cold), ctx(55, 'very_idle'), peers);
    expect(d.candidate).toBe('skip');
    expect(d.scores.demand).toBeLessThan(60);
  });

  it('does not discount a style whose coupon would fall below the profit-per-hour floor', () => {
    const highFloor = { ...ctx(55, 'very_idle'), minProfitPerHourCents: 999_999 };
    const d = decideStyle(input(interestedNotConverting), highFloor, peers);
    expect(d.candidate).toBe('display_only');
    expect(d.signals).toContain('below_coupon_floor');
  });
});
