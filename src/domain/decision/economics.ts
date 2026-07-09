// Decision brain — T1: per-style unit economics (ADR-0012 Phase 1, PM spec step 2).
// Pure + cents throughout. Nail economics: TIME is the scarce resource, so the headline metric is
// profit-per-HOUR, not margin. Cost model (ADR-0012 §6): variable cost is an ABSOLUTE amount fixed from
// the normal price (material ≈ VARIABLE_COST_RATE of it — it does not shrink when you discount), while the
// platform fee is a % of the actual transaction price. That combination makes break-even a real floor.

export const VARIABLE_COST_RATE = 0.15; // material as a fraction of the normal price (config assumption)
export const PLATFORM_FEE_RATE = 0.06; // 美团-style commission on the transaction (config assumption)

export type EconomicsConfig = { variableCostRate: number; platformFeeRate: number };
const DEFAULTS: EconomicsConfig = { variableCostRate: VARIABLE_COST_RATE, platformFeeRate: PLATFORM_FEE_RATE };

export type StyleEconomics = {
  priceCents: number;
  durationMin: number;
  variableCostCents: number; // absolute material cost (fixed across discounts)
  contributionCents: number; // at the normal price
  revenuePerHourCents: number;
  profitPerHourCents: number;
  contributionMarginPct: number; // contribution / price, 0..1
  breakEvenCouponCents: number; // lowest coupon price that still breaks even
};

const perHour = (cents: number, durationMin: number): number =>
  durationMin > 0 ? Math.round((cents / durationMin) * 60) : 0;

/** Contribution (cents) at an arbitrary transaction price — used for coupon simulation.
 *  = txPrice − fixed material cost (from the normal price) − platform fee on the tx price. */
export function contributionAtPriceCents(
  normalPriceCents: number,
  txPriceCents: number,
  config: EconomicsConfig = DEFAULTS,
): number {
  const variableCostCents = Math.round(normalPriceCents * config.variableCostRate);
  const platformFeeCents = Math.round(txPriceCents * config.platformFeeRate);
  return txPriceCents - variableCostCents - platformFeeCents;
}

export function computeStyleEconomics(
  priceCents: number,
  durationMin: number,
  config: EconomicsConfig = DEFAULTS,
): StyleEconomics {
  const variableCostCents = Math.round(priceCents * config.variableCostRate);
  const contributionCents = contributionAtPriceCents(priceCents, priceCents, config);
  // break-even: txPrice − variableCost − txPrice·fee ≥ 0  →  txPrice ≥ variableCost / (1 − fee)
  const breakEvenCouponCents = Math.round(variableCostCents / (1 - config.platformFeeRate));
  return {
    priceCents,
    durationMin,
    variableCostCents,
    contributionCents,
    revenuePerHourCents: perHour(priceCents, durationMin),
    profitPerHourCents: perHour(contributionCents, durationMin),
    contributionMarginPct: priceCents > 0 ? contributionCents / priceCents : 0,
    breakEvenCouponCents,
  };
}

/** Profit-per-hour (cents) at a discounted coupon price — the T4 coupon gate uses this vs the floor. */
export function couponProfitPerHourCents(
  normalPriceCents: number,
  couponPriceCents: number,
  durationMin: number,
  config: EconomicsConfig = DEFAULTS,
): number {
  return perHour(contributionAtPriceCents(normalPriceCents, couponPriceCents, config), durationMin);
}
