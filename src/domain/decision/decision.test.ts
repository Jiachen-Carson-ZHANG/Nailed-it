import { describe, expect, it } from 'vitest';
import { computeStyleEconomics, couponProfitPerHourCents } from './economics';
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

// Exposure is relative, so the ad-quadrant facts need a peer set. `hog` soaks up impressions with
// mediocre engagement, which is what leaves `converting` under-surfaced relative to its demand.
const hog: FunnelCounts = { impressions: 9000, clicks: 90, detailViews: 40, saves: 5, tryOns: 5, bookings: 2, completedOrders: 2 };
const peersOf = (inputs: StyleDecisionInput[]) => decideStyles(inputs, ctx(60, 'normal'));

/** Peer totals for a solo `decideStyle` call, with a synthetic impression-hogging peer alongside. */
const withPeer = {
  maxProfitPerHourCents: econ.profitPerHourCents,
  maxRevenuePerHourCents: econ.revenuePerHourCents,
  maxPriceCents: econ.priceCents,
  totalImpressions: 10_000, // 1000 (this style) + 9000 (the hog)
  totalDemandScore: computeFunnelScores(converting).demandScore + computeFunnelScores(hog).demandScore,
  stylesWithImpressions: 2,
};

// ADR-0016: the engine emits FACTS (signals + economics), never a candidate verdict — these tests
// pin the facts each PM quadrant produces; what to DO with them is the decision agent's judgment.
describe('decideStyle — the four PM quadrants as facts', () => {
  it('明星利润款: profitable + converting + underexposed + ROAS clears — the ad-case facts align', () => {
    const d = decideStyle(input(converting), ctx(60, 'normal'), withPeer);
    expect(d.scores.conversion).toBeGreaterThanOrEqual(65);
    expect(d.signals).toEqual(expect.arrayContaining([
      'high_profit_per_hour', 'high_conversion', 'underexposed', 'roas_above_target', 'fits',
    ]));
  });

  it('闲时填充款: interested-but-stuck + idle + discountable above the floor', () => {
    const d = decideStyle(input(interestedNotConverting), ctx(55, 'very_idle'), withPeer);
    expect(d.signals).toEqual(expect.arrayContaining(['high_demand', 'low_conversion', 'idle_capacity']));
    expect(d.coupon.referencePriceCents).toBe(16000); // 20% off ¥200 — a fact, not a recommendation
    expect(d.coupon.referenceAboveFloor).toBe(true);
    // the floor price really is the break-even point of the merchant's profit/hour floor
    expect(couponProfitPerHourCents(econ.priceCents, d.coupon.floorPriceCents!, econ.durationMin))
      .toBeGreaterThanOrEqual(1000);
    expect(couponProfitPerHourCents(econ.priceCents, d.coupon.floorPriceCents! - 100, econ.durationMin))
      .toBeLessThan(1000);
  });

  it('busy week: the capacity facts flip while the funnel facts stay identical', () => {
    const d = decideStyle(input(interestedNotConverting), ctx(82, 'near_full'), withPeer);
    expect(d.signals).toContain('full_capacity'); // >70% — the agent reads this, code no longer verdicts
    expect(d.signals).toContain('high_demand');
  });

  it('低效款: no demand, and the facts say so', () => {
    const d = decideStyle(input(cold), ctx(55, 'very_idle'), withPeer);
    expect(d.scores.demand).toBeLessThan(60);
    expect(d.signals).toContain('low_demand');
  });

  it('flags a style whose coupon cannot clear the profit-per-hour floor', () => {
    const highFloor = { ...ctx(55, 'very_idle'), minProfitPerHourCents: 999_999 };
    const d = decideStyle(input(interestedNotConverting), highFloor, withPeer);
    expect(d.signals).toContain('below_coupon_floor');
    expect(d.coupon.referenceAboveFloor).toBe(false);
    expect(d.coupon.floorPriceCents).toBeNull(); // even full price is below this absurd floor
  });
});

describe('ad economics facts stay honest (ADR-0012 Phase 2 gates, as signals)', () => {
  it('marks ROAS below the merchant target', () => {
    const expensive: FunnelCounts = { ...converting, bookings: 1, completedOrders: 1 };
    const d = decideStyle(input(expensive), { ...ctx(60, 'normal'), targetRoi: 200 }, withPeer);
    expect(d.signals).toContain('roas_below_target');
  });

  it('unknown ROAS is reported as unknown — never silently estimated', () => {
    const noClicks: FunnelCounts = { ...converting, clicks: 0, bookings: 0, completedOrders: 0 };
    const d = decideStyle(input(noClicks), ctx(60, 'normal'), withPeer);
    expect(d.ad.expectedRoas).toBeNull();
    expect(d.signals).toContain('roas_unknown');
  });

  it('marks the over-exposed impression hog and the underexposed peer in one batch', () => {
    const decisions = peersOf([input(hog, 'hog'), input(converting, 'star')]);
    expect(decisions.find((d) => d.styleId === 'hog')!.signals).toContain('over_exposed');
    expect(decisions.find((d) => d.styleId === 'star')!.signals).toContain('underexposed');
  });

  it('never claims exposure for a solo style — one style is 100% of its own batch', () => {
    const [only] = decideStyles([input(converting)], ctx(60, 'normal'));
    expect(only.ad.exposureRatio).toBeNull();
    expect(only.signals).toContain('exposure_unknown');
  });

  it('ROAS is scale-free: the budget never enters the calculation', () => {
    const d = decideStyle(input(converting), ctx(60, 'normal'), withPeer);
    expect(d.ad.clickToBookingRate).toBeCloseTo(0.2, 5);
    expect(d.ad.costPerBookingCents).toBe(600);
    expect(d.ad.expectedRoas).toBeCloseTo(15800 / 600, 5);
    expect(d.ad.expectedProfitPerBookingCents).toBe(15200);
  });
});
