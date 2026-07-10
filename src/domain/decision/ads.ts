// Decision brain — T5: ad economics + measured exposure (ADR-0012 Phase 2, the gate decision.ts deferred).
// Pure. Answers the only question that justifies ad spend: does a dollar of ads return more than a dollar?
//
// Two independent things were missing from the ad gate:
//  1. ROAS. The gate fired on scores + capacity, never on money. A style can score well and still be a bad
//     buy if acquiring a booking costs more than the booking earns.
//  2. Underexposure. The `underexposed` signal was emitted BY the ad branch — it meant "we decided to ad",
//     not "this style gets less surface than its demand warrants". Circular. Now it is measured.
//
// KEY PROPERTY: ROAS is scale-free. bookings = spend / costPerBooking, so
//     ROAS = (spend / costPerBooking) × contribution / spend = contribution / costPerBooking
// The budget cancels. Whether to advertise a style is a property of the STYLE, not of the daily budget —
// the budget only decides how much of a good buy to buy. That is why this gate lives in the brain and the
// budget cap lives in the envelope (ADR-0012 §2).
//
// HONEST LIMIT: we treat every ad-driven booking as incremental. Some fraction would have booked organically
// (cannibalisation), so expectedRoas is an UPPER bound. Measuring true lift needs a holdout experiment; when
// style_ad_campaign accumulates real impressions/clicks/bookings, replace the estimate with that measurement
// rather than inventing a lift factor here.

import type { StyleEconomics } from './economics';

/** Cost of one ad click (cents). A config assumption until the campaign table has real auction data —
 *  ¥1.20, in line with 美团 beauty-category CPC and coherent with the ¥50/day auto-launch cap (~41 clicks). */
export const AD_COST_PER_CLICK_CENTS = 120;

/** A style is underexposed when its share of impressions falls this far below its share of demand.
 *  At parity (ratio ≈ 1) the shop's organic surface already matches the style's pull, so paid amplification
 *  has no misallocation to correct — only the under-surfaced minority is worth buying attention for. */
export const UNDEREXPOSURE_RATIO = 0.8;

export type AdInputCounts = {
  impressions: number;
  clicks: number;
  bookings: number;
};

export type AdEconomics = {
  /** Measured from the style's own funnel. null when it has no clicks — nothing to extrapolate from. */
  clickToBookingRate: number | null;
  /** Ad spend needed to buy one booking. null when clickToBookingRate is null or zero. */
  costPerBookingCents: number | null;
  /** Contribution earned per ad dollar spent. null when it cannot be computed — never assume. */
  expectedRoas: number | null;
  /** Contribution minus acquisition cost, per booking. Negative = each ad-driven booking loses money. */
  expectedProfitPerBookingCents: number | null;
  impressionShare: number; // 0..1 of the batch's impressions (attention received — a VOLUME share)
  demandShare: number; // 0..1 of the batch's demand score (attention earned — a RATE-quality share)
  /** impressionShare / demandShare. Mixing a volume share with a rate-quality share is deliberate: it reads
   *  "attention received vs attention earned". null when the comparison is not measurable — see below. */
  exposureRatio: number | null;
  underexposed: boolean;
};

export type AdPeerTotals = {
  totalImpressions: number;
  totalDemandScore: number;
  /** Exposure is a RELATIVE claim. One style is 100% of its own batch; that is not evidence of anything. */
  stylesWithImpressions: number;
};

export function adPeerTotals(styles: Array<{ counts: AdInputCounts; demandScore: number }>): AdPeerTotals {
  return {
    totalImpressions: styles.reduce((sum, s) => sum + s.counts.impressions, 0),
    totalDemandScore: styles.reduce((sum, s) => sum + s.demandScore, 0),
    stylesWithImpressions: styles.filter((s) => s.counts.impressions > 0).length,
  };
}

export function computeAdEconomics(
  counts: AdInputCounts,
  demandScore: number,
  economics: StyleEconomics,
  peers: AdPeerTotals,
  costPerClickCents: number = AD_COST_PER_CLICK_CENTS,
): AdEconomics {
  const clickToBookingRate = counts.clicks > 0 ? counts.bookings / counts.clicks : null;

  const costPerBookingCents =
    clickToBookingRate !== null && clickToBookingRate > 0
      ? Math.round(costPerClickCents / clickToBookingRate)
      : null;

  const expectedRoas = costPerBookingCents !== null && costPerBookingCents > 0
    ? economics.contributionCents / costPerBookingCents
    : null;

  const expectedProfitPerBookingCents = costPerBookingCents !== null
    ? economics.contributionCents - costPerBookingCents
    : null;

  const impressionShare = peers.totalImpressions > 0 ? counts.impressions / peers.totalImpressions : 0;
  const demandShare = peers.totalDemandScore > 0 ? demandScore / peers.totalDemandScore : 0;

  // Unknown is not the same as exposed. Without at least two impression-carrying styles, or with no demand
  // signal, there is nothing to be relative TO — so we report null rather than a meaningless 1.0. The agent
  // narrates these signals; a fabricated "over-exposed" would become a fabricated reason.
  const measurable = peers.stylesWithImpressions >= 2 && peers.totalImpressions > 0 && demandShare > 0;
  const exposureRatio = measurable ? impressionShare / demandShare : null;

  return {
    clickToBookingRate,
    costPerBookingCents,
    expectedRoas,
    expectedProfitPerBookingCents,
    impressionShare,
    demandShare,
    exposureRatio,
    underexposed: exposureRatio !== null && exposureRatio < UNDEREXPOSURE_RATIO,
  };
}

/** The money gate: spend only when a booking earns at least `targetRoi`× what it costs to buy. An unknown
 *  ROAS is a NO — the merchant's default must be to keep the money. */
export function passesRoasGate(ad: AdEconomics, targetRoi: number): boolean {
  return ad.expectedRoas !== null && ad.expectedRoas >= targetRoi;
}
