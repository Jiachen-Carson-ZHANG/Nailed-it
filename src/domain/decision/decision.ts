// Decision brain — T4: the 4 scores + rule engine (ADR-0012 Phase 1, PM spec steps 6-8, 12).
// PURE and ADVISORY. Per ADR-0012 §5 the brain does NOT conclude or narrate — it returns each style's
// scores, the lever the economics point toward (`candidate`), and machine SIGNAL TAGS. The LLM agent
// synthesizes these across styles + briefing + capacity + the budget cap into the actual plan and writes
// the reason. No prose here.

import type { StyleEconomics } from './economics';
import { couponProfitPerHourCents } from './economics';
import type { FunnelScores } from './funnel';
import type { CapacityBand } from './capacity';

export type Recommendation = 'ad' | 'coupon' | 'display_only' | 'skip';

export type DecisionSignal =
  | 'high_profit_per_hour' | 'low_profit_per_hour'
  | 'high_demand' | 'low_demand'
  | 'high_conversion' | 'low_conversion'
  | 'idle_capacity' | 'full_capacity'
  | 'fits' | 'no_fit'
  | 'underexposed' | 'below_coupon_floor';

export type StyleDecisionInput = {
  styleId: string;
  styleTitle: string;
  economics: StyleEconomics;
  funnel: FunnelScores;
  fitsCapacity: boolean; // this style's duration fits a next-week gap (capacity.fitsStyle)
  adRoiTarget: number;
};

export type DecisionContext = {
  capacityBand: CapacityBand; // merchant-level, shared across styles
  capacityUtilizationPct: number;
  minProfitPerHourCents: number; // the coupon floor (from the merchant envelope)
  couponDiscountPct?: number; // suggested discount for a coupon candidate (default 0.2)
};

export type StyleDecision = {
  styleId: string;
  styleTitle: string;
  scores: { businessValue: number; demand: number; conversion: number; capacityFit: number };
  candidate: Recommendation;
  signals: DecisionSignal[];
  suggestedCouponCents: number | null; // set when candidate === 'coupon'
};

const AD = { biz: 70, conv: 65, demand: 60, utilMax: 85 };
const COUPON = { demand: 60, convBelow: 65, utilMax: 70 };
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

/** Decide one style. The peer maxima come from the batch so business value is relative (PM). */
export function decideStyle(
  input: StyleDecisionInput,
  ctx: DecisionContext,
  peers: { maxProfitPerHourCents: number; maxRevenuePerHourCents: number; maxPriceCents: number },
): StyleDecision {
  const { economics: e, funnel } = input;
  const businessValue = businessValueScore(e, peers.maxProfitPerHourCents, peers.maxRevenuePerHourCents, peers.maxPriceCents);
  const demand = funnel.demandScore;
  const conversion = funnel.conversionScore;
  const capacityFit = capacityFitScore(ctx.capacityBand, input.fitsCapacity);

  const signals: DecisionSignal[] = [];
  signals.push(businessValue >= AD.biz ? 'high_profit_per_hour' : 'low_profit_per_hour');
  signals.push(demand >= COUPON.demand ? 'high_demand' : 'low_demand');
  signals.push(conversion >= AD.conv ? 'high_conversion' : 'low_conversion');
  signals.push(ctx.capacityUtilizationPct <= COUPON.utilMax ? 'idle_capacity' : 'full_capacity');
  signals.push(input.fitsCapacity ? 'fits' : 'no_fit');

  const discount = ctx.couponDiscountPct ?? 0.2;
  const suggestedCoupon = Math.round(e.priceCents * (1 - discount));
  const couponPPH = couponProfitPerHourCents(e.priceCents, suggestedCoupon, e.durationMin);
  const couponAboveFloor = couponPPH >= ctx.minProfitPerHourCents;

  let candidate: Recommendation;
  if (
    businessValue >= AD.biz && conversion >= AD.conv && demand >= AD.demand &&
    ctx.capacityUtilizationPct <= AD.utilMax && input.fitsCapacity
  ) {
    candidate = 'ad'; // already-profitable + converting + underexposed + room to serve
    signals.push('underexposed');
  } else if (
    demand >= COUPON.demand && conversion < COUPON.convBelow &&
    ctx.capacityUtilizationPct <= COUPON.utilMax && input.fitsCapacity && couponAboveFloor
  ) {
    candidate = 'coupon'; // interested-but-stuck + idle + still profitable discounted
  } else if (demand >= COUPON.demand) {
    candidate = 'display_only'; // real interest but can't justify spend (full / no-fit / below floor / low value)
    if (!couponAboveFloor) signals.push('below_coupon_floor');
  } else {
    candidate = 'skip';
  }

  return {
    styleId: input.styleId,
    styleTitle: input.styleTitle,
    scores: { businessValue, demand, conversion, capacityFit },
    candidate,
    signals,
    suggestedCouponCents: candidate === 'coupon' ? suggestedCoupon : null,
  };
}

/** Decide the whole style set — computes peer maxima once, then decides each. */
export function decideStyles(inputs: StyleDecisionInput[], ctx: DecisionContext): StyleDecision[] {
  const peers = {
    maxProfitPerHourCents: Math.max(0, ...inputs.map((i) => i.economics.profitPerHourCents)),
    maxRevenuePerHourCents: Math.max(0, ...inputs.map((i) => i.economics.revenuePerHourCents)),
    maxPriceCents: Math.max(0, ...inputs.map((i) => i.economics.priceCents)),
  };
  return inputs.map((i) => decideStyle(i, ctx, peers));
}
