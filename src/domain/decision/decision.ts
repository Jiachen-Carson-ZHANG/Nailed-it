// Business Engine — the 4 scores + per-style FACTS (ADR-0012 Phase 1, rebuilt by ADR-0016 §1).
// PURE and FACTUAL. It no longer emits a `candidate` verdict — an engine that answers "what should
// we do" leaves the decision agent restating it (observed live). It returns each style's scores,
// machine SIGNAL TAGS (each one an independently checkable fact), ad economics, and coupon
// economics (floor/reference prices). WHAT to do about them is 决策's judgment, expressed as
// Action Briefs. No prose here.

import type { StyleEconomics } from './economics';
import { couponProfitPerHourCents } from './economics';
import type { FunnelScores, FunnelCounts } from './funnel';
import type { CapacityBand } from './capacity';
import type { AdEconomics, AdPeerTotals } from './ads';
import { adPeerTotals, computeAdEconomics, passesRoasGate } from './ads';

export type DecisionSignal =
  | 'high_profit_per_hour' | 'low_profit_per_hour'
  | 'high_demand' | 'low_demand'
  | 'high_conversion' | 'low_conversion'
  | 'idle_capacity' | 'full_capacity'
  | 'fits' | 'no_fit'
  | 'underexposed' | 'over_exposed' | 'exposure_unknown'
  | 'roas_above_target' | 'roas_below_target' | 'roas_unknown'
  | 'below_coupon_floor';

export type StyleDecisionInput = {
  styleId: string;
  styleTitle: string;
  economics: StyleEconomics;
  funnel: FunnelScores;
  counts: FunnelCounts; // raw counts — the ad gate needs measured impressions/clicks/bookings, not scores
  fitsCapacity: boolean; // this style's duration fits a next-week gap (capacity.fitsStyle)
};

export type DecisionContext = {
  capacityBand: CapacityBand; // merchant-level, shared across styles
  capacityUtilizationPct: number;
  minProfitPerHourCents: number; // the coupon floor (from the merchant envelope)
  targetRoi: number; // the merchant's ad ROI target — ad spend must clear it (domain/style-ad DEFAULT_TARGET_ROI)
  couponDiscountPct?: number; // suggested discount for a coupon candidate (default 0.2)
};

/** Coupon ECONOMICS as facts (ADR-0016): what a discount costs, never whether to run one. */
export type CouponEconomics = {
  /** 20%-off reference price — a comparison anchor, not a recommendation. */
  referencePriceCents: number;
  /** Profit/hour if sold at the reference price. */
  profitPerHourAtReferenceCents: number;
  /** The lowest coupon price that still clears the merchant's profit/hour floor (null = even full
   *  price is below floor — discounting is structurally unprofitable for this style). */
  floorPriceCents: number | null;
  /** Whether the reference price clears the floor. */
  referenceAboveFloor: boolean;
};

export type StyleDecision = {
  styleId: string;
  styleTitle: string;
  /** Raw facts the ad sandbox forecast consumes (ADR-0016): service time + price. */
  durationMin: number;
  priceCents: number;
  scores: { businessValue: number; demand: number; conversion: number; capacityFit: number };
  signals: DecisionSignal[];
  /** The money behind any ad idea — the agent quotes these, no label decides for it. */
  ad: AdEconomics;
  /** The money behind any coupon idea — floor and reference prices as facts. */
  coupon: CouponEconomics;
};

const AD = { biz: 70, conv: 65 };
const COUPON = { demand: 60, utilMax: 70 };
const round1 = (n: number): number => Math.round(n * 10) / 10;
const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));
const availableScore: Record<CapacityBand, number> = { very_idle: 100, normal: 70, near_full: 30, full: 0 };

/** Batch-relative business-value score (PM: "高于店铺均值") — needs the peer set for max normalization. */
function businessValueScore(e: StyleEconomics, maxPPH: number, maxRPH: number, maxPrice: number): number {
  const pph = maxPPH > 0 ? (e.profitPerHourCents / maxPPH) * 100 : 0;
  const rph = maxRPH > 0 ? (e.revenuePerHourCents / maxRPH) * 100 : 0;
  const margin = clamp100(e.contributionMarginPct * 100);
  const premium = maxPrice > 0 ? (e.priceCents / maxPrice) * 100 : 0;
  return round1(0.35 * pph + 0.25 * rph + 0.2 * margin + 0.2 * premium);
}

/** Simplified Capacity-Fit (PM 40/30/20/10 → we have availability + fragment-fit; staff-skill/time-fit
 *  granularity is a follow-up). */
function capacityFitScore(band: CapacityBand, fits: boolean): number {
  return round1(0.6 * availableScore[band] + 0.4 * (fits ? 100 : 0));
}

type Peers = {
  maxProfitPerHourCents: number;
  maxRevenuePerHourCents: number;
  maxPriceCents: number;
} & AdPeerTotals;

/** Decide one style. The peer maxima/totals come from the batch so business value and exposure are both
 *  relative (PM: "高于店铺均值"). */
export function decideStyle(input: StyleDecisionInput, ctx: DecisionContext, peers: Peers): StyleDecision {
  const { economics: e, funnel } = input;
  const businessValue = businessValueScore(e, peers.maxProfitPerHourCents, peers.maxRevenuePerHourCents, peers.maxPriceCents);
  const demand = funnel.demandScore;
  const conversion = funnel.conversionScore;
  const capacityFit = capacityFitScore(ctx.capacityBand, input.fitsCapacity);
  const ad = computeAdEconomics(input.counts, demand, e, peers);

  const signals: DecisionSignal[] = [];
  signals.push(businessValue >= AD.biz ? 'high_profit_per_hour' : 'low_profit_per_hour');
  signals.push(demand >= COUPON.demand ? 'high_demand' : 'low_demand');
  signals.push(conversion >= AD.conv ? 'high_conversion' : 'low_conversion');
  signals.push(ctx.capacityUtilizationPct <= COUPON.utilMax ? 'idle_capacity' : 'full_capacity');
  signals.push(input.fitsCapacity ? 'fits' : 'no_fit');
  signals.push(
    ad.exposureRatio === null ? 'exposure_unknown' : ad.underexposed ? 'underexposed' : 'over_exposed',
  );
  signals.push(
    ad.expectedRoas === null ? 'roas_unknown'
      : passesRoasGate(ad, ctx.targetRoi) ? 'roas_above_target'
        : 'roas_below_target',
  );

  // Coupon economics as FACTS: the reference price (20% off), its profit/hour, and the lowest price
  // that still clears the merchant's floor. Whether to discount at all is the agent's judgment.
  const discount = ctx.couponDiscountPct ?? 0.2;
  const referencePriceCents = Math.round(e.priceCents * (1 - discount));
  const profitAtReference = couponProfitPerHourCents(e.priceCents, referencePriceCents, e.durationMin);
  const referenceAboveFloor = profitAtReference >= ctx.minProfitPerHourCents;
  const floorPriceCents = couponFloorPriceCents(e, ctx.minProfitPerHourCents);
  if (!referenceAboveFloor) signals.push('below_coupon_floor');

  return {
    styleId: input.styleId,
    styleTitle: input.styleTitle,
    durationMin: e.durationMin,
    priceCents: e.priceCents,
    scores: { businessValue, demand, conversion, capacityFit },
    signals,
    ad,
    coupon: {
      referencePriceCents,
      profitPerHourAtReferenceCents: profitAtReference,
      floorPriceCents,
      referenceAboveFloor,
    },
  };
}

/** The lowest coupon price whose profit/hour still clears the floor — solved by inverting
 *  couponProfitPerHourCents (linear in price). null when even the full price is below floor. */
function couponFloorPriceCents(e: StyleEconomics, minProfitPerHourCents: number): number | null {
  if (couponProfitPerHourCents(e.priceCents, e.priceCents, e.durationMin) < minProfitPerHourCents) {
    return null;
  }
  // binary search keeps this robust to the economics formula's internals (fees, variable costs)
  let lo = 0;
  let hi = e.priceCents;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (couponProfitPerHourCents(e.priceCents, mid, e.durationMin) >= minProfitPerHourCents) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Decide the whole style set — computes peer maxima + exposure totals once, then decides each. */
export function decideStyles(inputs: StyleDecisionInput[], ctx: DecisionContext): StyleDecision[] {
  const totals = adPeerTotals(inputs.map((i) => ({ counts: i.counts, demandScore: i.funnel.demandScore })));
  const peers: Peers = {
    maxProfitPerHourCents: Math.max(0, ...inputs.map((i) => i.economics.profitPerHourCents)),
    maxRevenuePerHourCents: Math.max(0, ...inputs.map((i) => i.economics.revenuePerHourCents)),
    maxPriceCents: Math.max(0, ...inputs.map((i) => i.economics.priceCents)),
    ...totals,
  };
  return inputs.map((i) => decideStyle(i, ctx, peers));
}
