import { describe, expect, it } from 'vitest';
import { computeStyleEconomics } from './economics';
import { computeFunnelScores, type FunnelCounts } from './funnel';
import { decideStyle, decideStyles, type DecisionContext, type StyleDecisionInput } from './decision';

const econ = computeStyleEconomics(20000, 60); // ¥200, 60min → strong profit/hour

const converting: FunnelCounts = { impressions: 1000, clicks: 100, detailViews: 80, saves: 25, tryOns: 25, bookings: 20, completedOrders: 18 };
const interestedNotConverting: FunnelCounts = { impressions: 1000, clicks: 120, detailViews: 100, saves: 40, tryOns: 45, bookings: 3, completedOrders: 3 };
const cold: FunnelCounts = { impressions: 1000, clicks: 8, detailViews: 4, saves: 1, tryOns: 1, bookings: 0, completedOrders: 0 };

const input = (funnel: FunnelCounts, styleId = 's'): StyleDecisionInput => ({
  styleId, styleTitle: '款', economics: econ, funnel: computeFunnelScores(funnel), counts: funnel, fitsCapacity: true,
});
const ctx = (utilPct: number, band: DecisionContext['capacityBand']): DecisionContext => ({
  capacityBand: band, capacityUtilizationPct: utilPct, minProfitPerHourCents: 1000, targetRoi: 2.0,
});

// Exposure is relative, so the ad quadrant needs a peer set. `hog` soaks up impressions with mediocre
// engagement, which is what leaves `converting` under-surfaced relative to the demand it earns.
const hog: FunnelCounts = { impressions: 9000, clicks: 90, detailViews: 40, saves: 5, tryOns: 5, bookings: 2, completedOrders: 2 };
const peersOf = (inputs: StyleDecisionInput[]) => {
  const decisions = decideStyles(inputs, ctx(60, 'normal'));
  return decisions;
};

/** Peer totals for a solo `decideStyle` call, with a synthetic impression-hogging peer alongside. */
const withPeer = {
  maxProfitPerHourCents: econ.profitPerHourCents,
  maxRevenuePerHourCents: econ.revenuePerHourCents,
  maxPriceCents: econ.priceCents,
  totalImpressions: 10_000, // 1000 (this style) + 9000 (the hog)
  totalDemandScore: computeFunnelScores(converting).demandScore + computeFunnelScores(hog).demandScore,
  stylesWithImpressions: 2,
};

describe('decideStyle — the four PM quadrants', () => {
  it('明星利润款 → ad (profitable + converting + underexposed + ROAS clears + room to serve)', () => {
    const d = decideStyle(input(converting), ctx(60, 'normal'), withPeer);
    expect(d.candidate).toBe('ad');
    expect(d.scores.conversion).toBeGreaterThanOrEqual(65);
    expect(d.signals).toContain('underexposed');
    expect(d.signals).toContain('roas_above_target');
  });

  it('闲时填充款 → coupon (interested-but-stuck + idle + still profitable discounted)', () => {
    const d = decideStyle(input(interestedNotConverting), ctx(55, 'very_idle'), withPeer);
    expect(d.candidate).toBe('coupon');
    expect(d.suggestedCouponCents).toBe(16000); // 20% off ¥200
  });

  it('展示种草款 → display_only (same interest, but next week is busy → no discount)', () => {
    const d = decideStyle(input(interestedNotConverting), ctx(82, 'near_full'), withPeer);
    expect(d.candidate).toBe('display_only'); // coupon gated by capacity (>70%), ad gated by conversion
  });

  it('低效款 → skip (no demand)', () => {
    const d = decideStyle(input(cold), ctx(55, 'very_idle'), withPeer);
    expect(d.candidate).toBe('skip');
    expect(d.scores.demand).toBeLessThan(60);
  });

  it('does not discount a style whose coupon would fall below the profit-per-hour floor', () => {
    const highFloor = { ...ctx(55, 'very_idle'), minProfitPerHourCents: 999_999 };
    const d = decideStyle(input(interestedNotConverting), highFloor, withPeer);
    expect(d.candidate).toBe('display_only');
    expect(d.signals).toContain('below_coupon_floor');
  });
});

describe('the ad gate spends only when the money clears (ADR-0012 Phase 2)', () => {
  it('refuses to advertise a style whose ROAS is below the merchant target', () => {
    // Same demand/exposure, but a punishing click→booking rate: 100 clicks buy 1 booking.
    const expensive: FunnelCounts = { ...converting, bookings: 1, completedOrders: 1 };
    const d = decideStyle(input(expensive), { ...ctx(60, 'normal'), targetRoi: 200 }, withPeer);
    expect(d.signals).toContain('roas_below_target');
    expect(d.candidate).not.toBe('ad');
  });

  it('refuses to advertise when ROAS cannot be measured — unknown money is a NO', () => {
    const noClicks: FunnelCounts = { ...converting, clicks: 0, bookings: 0, completedOrders: 0 };
    const d = decideStyle(input(noClicks), ctx(60, 'normal'), withPeer);
    expect(d.ad.expectedRoas).toBeNull();
    expect(d.signals).toContain('roas_unknown');
    expect(d.candidate).not.toBe('ad');
  });

  it('refuses to advertise an already over-exposed style — more impressions correct nothing', () => {
    // The hog holds 90% of impressions; even good economics should not buy it more attention.
    const decisions = peersOf([input(hog, 'hog'), input(converting, 'star')]);
    const hogDecision = decisions.find((d) => d.styleId === 'hog')!;
    expect(hogDecision.signals).toContain('over_exposed');
    expect(hogDecision.candidate).not.toBe('ad');
  });

  it('surfaces the underexposed peer in the same batch', () => {
    const decisions = peersOf([input(hog, 'hog'), input(converting, 'star')]);
    const star = decisions.find((d) => d.styleId === 'star')!;
    expect(star.signals).toContain('underexposed');
    expect(star.candidate).toBe('ad');
  });

  it('never claims exposure for a solo style — one style is 100% of its own batch', () => {
    const [only] = decideStyles([input(converting)], ctx(60, 'normal'));
    expect(only.ad.exposureRatio).toBeNull();
    expect(only.signals).toContain('exposure_unknown');
    expect(only.candidate).not.toBe('ad'); // unmeasurable exposure cannot justify spend
  });

  it('ROAS is scale-free: the budget never enters the calculation', () => {
    const d = decideStyle(input(converting), ctx(60, 'normal'), withPeer);
    // 100 clicks → 20 bookings = 0.2; ¥1.20 per click → ¥6.00 per booking; contribution ¥158.
    expect(d.ad.clickToBookingRate).toBeCloseTo(0.2, 5);
    expect(d.ad.costPerBookingCents).toBe(600);
    expect(d.ad.expectedRoas).toBeCloseTo(15800 / 600, 5);
    expect(d.ad.expectedProfitPerBookingCents).toBe(15200);
  });
});
