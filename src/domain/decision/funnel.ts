// Decision brain — T2: funnel rates → Demand & Conversion scores (ADR-0012 Phase 1, PM spec steps 3 & 6).
// Pure over aggregate counts (the action layer aggregates them from analytics_events + booking completion).
// Each rate becomes a 0..100 sub-score by dividing against a target rate (config assumption, tunable) and
// capping at 100; Demand/Conversion are the PM's weighted sums. searchDemandMatch is supplied as a 0..100
// score (from search-gap matching) — 0 when there is no search signal.

export type FunnelCounts = {
  impressions: number;
  clicks: number;
  detailViews: number;
  saves: number;
  tryOns: number;
  bookings: number;
  completedOrders: number;
  searchDemandMatchScore?: number; // 0..100, optional
};

/** Target rates a "great" style hits; a rate at target scores 100. Assumptions — tune with real data. */
export type FunnelTargets = {
  ctr: number; detailRate: number; saveRate: number; tryOnRate: number;
  bookingRate: number; completionRate: number; bookingPerImpression: number; tryOnToBooking: number;
};
export const DEFAULT_TARGETS: FunnelTargets = {
  ctr: 0.08, detailRate: 0.5, saveRate: 0.25, tryOnRate: 0.3,
  bookingRate: 0.15, completionRate: 0.85, bookingPerImpression: 0.02, tryOnToBooking: 0.4,
};

export type FunnelRates = {
  ctr: number; detailRate: number; saveRate: number; tryOnRate: number;
  bookingRate: number; completionRate: number; bookingPerImpression: number; tryOnToBooking: number;
};

export type FunnelScores = { rates: FunnelRates; demandScore: number; conversionScore: number };

const rate = (num: number, den: number): number => (den > 0 ? num / den : 0);
const sub = (r: number, target: number): number => (target > 0 ? Math.min(100, (r / target) * 100) : 0);
const round1 = (n: number): number => Math.round(n * 10) / 10;

export function computeFunnelScores(counts: FunnelCounts, targets: FunnelTargets = DEFAULT_TARGETS): FunnelScores {
  const rates: FunnelRates = {
    ctr: rate(counts.clicks, counts.impressions),
    detailRate: rate(counts.detailViews, counts.clicks),
    saveRate: rate(counts.saves, counts.detailViews),
    tryOnRate: rate(counts.tryOns, counts.detailViews),
    bookingRate: rate(counts.bookings, counts.detailViews),
    completionRate: rate(counts.completedOrders, counts.bookings),
    bookingPerImpression: rate(counts.bookings, counts.impressions),
    tryOnToBooking: rate(counts.bookings, counts.tryOns),
  };
  const searchScore = Math.max(0, Math.min(100, counts.searchDemandMatchScore ?? 0));

  const demandScore = round1(
    0.25 * sub(rates.ctr, targets.ctr) +
      0.2 * sub(rates.detailRate, targets.detailRate) +
      0.2 * sub(rates.saveRate, targets.saveRate) +
      0.2 * sub(rates.tryOnRate, targets.tryOnRate) +
      0.15 * searchScore,
  );
  const conversionScore = round1(
    0.35 * sub(rates.bookingRate, targets.bookingRate) +
      0.25 * sub(rates.completionRate, targets.completionRate) +
      0.2 * sub(rates.bookingPerImpression, targets.bookingPerImpression) +
      0.2 * sub(rates.tryOnToBooking, targets.tryOnToBooking),
  );
  return { rates, demandScore, conversionScore };
}
