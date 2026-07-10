'use server';

import { getRepositories } from '@/lib/repositories';
import { demoMerchantId } from '@/mock/merchants';
import { localDateKey } from '@/domain/merchant-home';
import { computeStyleEconomics } from '@/domain/decision/economics';
import { computeFunnelScores, type FunnelCounts } from '@/domain/decision/funnel';
import { computeCapacity, type CapacityDay, type CapacityBand } from '@/domain/decision/capacity';
import { funnelCountsByStyle, bookingsToBusyIntervals } from '@/domain/decision/aggregate';
import { decideStyles, type StyleDecision, type StyleDecisionInput } from '@/domain/decision/decision';
import { DEFAULT_TARGET_ROI } from '@/domain/style-ad';
import type { Weekday } from '@/domain/scheduling';
import { listMerchantBookingViewsAction } from './booking-actions';

// ADR-0012 Phase 2 read model. Thin I/O shell: fetch rows → the pure brain (economics/funnel/capacity/
// decision) → per-style recommendations. Merchant tz + envelope floor are demo constants until wired to the
// merchant policy (投广中心). The 决策 agent consumes THIS output; it does not re-derive the numbers.
const MERCHANT_TZ = 'Asia/Singapore';
const DEFAULT_MIN_PROFIT_PER_HOUR_CENTS = 3000; // ¥30/hr floor for coupons — from the envelope later
const DAY_MS = 86_400_000;

export type StyleBusinessDecisions = {
  decisions: StyleDecision[];
  capacity: { utilizationPct: number; band: CapacityBand; largestGapMin: number; remainingMin: number; totalMin: number };
  errors: string[];
};

/** The next 7 days (today..+6) in the merchant timezone, with weekday — the capacity window ("下周能接住"). */
function nextWeekDays(nowMs: number): CapacityDay[] {
  const days: CapacityDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = localDateKey(nowMs + i * DAY_MS, MERCHANT_TZ);
    const [y, mo, d] = date.split('-').map(Number);
    days.push({ date, weekday: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() as Weekday });
  }
  return days;
}

export async function getStyleBusinessDecisionsAction(): Promise<StyleBusinessDecisions> {
  const repos = getRepositories();
  const nowMs = Date.now();
  const days = nextWeekDays(nowMs);
  const errors: string[] = [];

  // Published, priced styles are the only ones the decision applies to.
  let styles: Array<{ id: string; title: string; priceCents: number; durationMin: number }> = [];
  try {
    const rows = await repos.merchantStyles.listByMerchant(demoMerchantId);
    styles = rows
      .filter((s) => s.status === 'published' && s.previewPriceCents != null && s.previewDurationMin != null)
      .map((s) => ({ id: s.id, title: s.title, priceCents: s.previewPriceCents as number, durationMin: s.previewDurationMin as number }));
  } catch { errors.push('styles'); }

  let countsByStyle = new Map<string, FunnelCounts>();
  try {
    const [events, bookings] = await Promise.all([
      repos.analytics.listByMerchant(demoMerchantId),
      listMerchantBookingViewsAction(),
    ]);
    const completedIds = new Set(bookings.filter((b) => b.status === 'completed').map((b) => b.id));
    countsByStyle = funnelCountsByStyle(events, completedIds);
  } catch { errors.push('analytics'); }

  // Capacity is merchant-level (shared band + largest gap); per-style fit is largestGap >= style duration.
  let cap = { totalMin: 0, busyMin: 0, remainingMin: 0, utilizationPct: 0, band: 'very_idle' as CapacityBand, largestGapMin: 0, fitsStyle: true };
  try {
    const [allTechs, workingPlans, bookings] = await Promise.all([
      repos.technicians.list(),
      repos.workingPlans.list(),
      listMerchantBookingViewsAction(),
    ]);
    const technicianIds = allTechs.filter((t) => t.merchantId === demoMerchantId && t.active).map((t) => t.id);
    const busy = bookingsToBusyIntervals(bookings, days);
    cap = computeCapacity({ technicianIds, workingPlans, busy, days, styleDurationMin: 0 });
  } catch { errors.push('capacity'); }

  const emptyCounts = { impressions: 0, clicks: 0, detailViews: 0, saves: 0, tryOns: 0, bookings: 0, completedOrders: 0 };
  const inputs: StyleDecisionInput[] = styles.map((s) => {
    const counts = countsByStyle.get(s.id) ?? emptyCounts;
    return {
      styleId: s.id,
      styleTitle: s.title,
      economics: computeStyleEconomics(s.priceCents, s.durationMin),
      funnel: computeFunnelScores(counts),
      counts, // the ad gate needs raw impressions/clicks/bookings, not the derived scores
      fitsCapacity: cap.largestGapMin >= s.durationMin,
    };
  });

  const decisions = decideStyles(inputs, {
    capacityBand: cap.band,
    capacityUtilizationPct: cap.utilizationPct,
    minProfitPerHourCents: DEFAULT_MIN_PROFIT_PER_HOUR_CENTS,
    targetRoi: DEFAULT_TARGET_ROI,
  });

  return {
    decisions,
    capacity: { utilizationPct: cap.utilizationPct, band: cap.band, largestGapMin: cap.largestGapMin, remainingMin: cap.remainingMin, totalMin: cap.totalMin },
    errors,
  };
}
