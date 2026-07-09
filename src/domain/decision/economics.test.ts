import { describe, expect, it } from 'vitest';
import {
  computeStyleEconomics,
  contributionAtPriceCents,
  couponProfitPerHourCents,
  PLATFORM_FEE_RATE,
  VARIABLE_COST_RATE,
} from './economics';

// ¥158, 70min (the PM's 冰透魔镜粉 example). variable = 158×0.15 = 23.70 → 2370c; fee = 158×0.06 = 9.48 → 948c.
const PRICE = 15800;
const DUR = 70;

describe('computeStyleEconomics', () => {
  const e = computeStyleEconomics(PRICE, DUR);
  it('fixes variable cost as a fraction of the normal price', () =>
    expect(e.variableCostCents).toBe(Math.round(PRICE * VARIABLE_COST_RATE)));
  it('contribution = price − material − fee', () =>
    expect(e.contributionCents).toBe(PRICE - Math.round(PRICE * VARIABLE_COST_RATE) - Math.round(PRICE * PLATFORM_FEE_RATE)));
  it('reports profit-per-hour in cents (the scarce-resource metric)', () =>
    expect(e.profitPerHourCents).toBe(Math.round((e.contributionCents / DUR) * 60)));
  it('break-even coupon still clears cost (contribution ≈ 0 at that price)', () => {
    expect(contributionAtPriceCents(PRICE, e.breakEvenCouponCents)).toBeGreaterThanOrEqual(0);
    expect(contributionAtPriceCents(PRICE, e.breakEvenCouponCents - 100)).toBeLessThan(0);
  });
  it('guards zero duration (no divide-by-zero)', () =>
    expect(computeStyleEconomics(PRICE, 0).profitPerHourCents).toBe(0));
});

describe('couponProfitPerHourCents', () => {
  it('drops when discounted but material cost stays fixed', () => {
    const full = computeStyleEconomics(PRICE, DUR).profitPerHourCents;
    const discounted = couponProfitPerHourCents(PRICE, 12800, DUR); // ¥128 coupon
    expect(discounted).toBeLessThan(full);
    expect(discounted).toBeGreaterThan(0);
  });
});
