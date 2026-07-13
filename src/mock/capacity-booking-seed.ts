// Synthetic capacity data (ADR-0012 Phase 2). The funnel seed (intelligence-seed) writes booking_confirmed
// *events* (a conversion count); the decision brain's capacity gate needs real *interval bookings* in the
// NEXT 7 DAYS. Those were missing — mockIntervalBookings are historical — so a live test read the salon as
// idle and the agent over-recommended discounts.
//
// The generator is TARGET-DRIVEN: you ask for a next-week utilization and it books until that budget is
// consumed, scattering gaps so fragment-fit varies. (A probabilistic per-slot fill cannot hit a target —
// it caps out ~72% because sub-45-minute tails are always lost, which meant the brain's capacity gates
// — coupon >70%, ad >85% — could never be exercised.)
//
// Pure + deterministic (seeded PRNG). No overlaps per technician (the cursor only moves forward, and the
// day is split around the 13:00–14:00 break). Rolling: dates are passed in, computed from "now" at seed
// time, so the data never goes stale.

import { createRng } from './prng';

export type BookingSeedRow = {
  id: string;
  merchantId: string;
  technicianId: string;
  customerName: string;
  styleTitle: string;
  styleImageUrl: string;
  startAt: string;
  endAt: string;
  durationMin: number;
  status: 'confirmed';
};

export type SeedStyle = { title: string; durationMin: number };

const OPEN = 600; // 10:00
const CLOSE = 1140; // 19:00
const BREAK_START = 780; // 13:00
const BREAK_END = 840; // 14:00
const MIN_BOOKABLE = 45;
const MAX_BOOKABLE = 150;
const TZ_OFFSET = '+08:00'; // demo merchant (Asia/Singapore, no DST)
const CUSTOMERS = ['Grace', 'Ivy', 'Nina', 'Cara', 'Bea', 'Joy', 'Wen', 'Mia', 'Sara', 'Lulu'];

/** Named capacity scenarios — the knob that makes the decision brain's gates actually bite.
 *  Coupons are gated above 70% utilization, ads above 85% (see domain/decision/decision.ts). */
// Targets are calibrated against the real working plans (achieved utilization in brackets); the achieved
// value is what the brain sees. Structural ceiling is ~86% (sub-45-min tails can't be booked).
export const CAPACITY_SCENARIOS = {
  idle: { targetUtilization: 0.35 }, // → ~39%: coupons + ads both allowed
  busy: { targetUtilization: 0.85 }, // → ~79%: coupons gated (>70%), ads still allowed (≤85%)
  full: { targetUtilization: 1.0 }, //  → ~86%: both gated — no discounting into a full week
} as const;
export type CapacityScenario = keyof typeof CAPACITY_SCENARIOS;

const clampDuration = (d: number): number => Math.max(MIN_BOOKABLE, Math.min(MAX_BOOKABLE, d || 60));
const pad = (n: number): string => String(n).padStart(2, '0');
const minToHm = (m: number): string => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const isoAt = (date: string, min: number): string => `${date}T${minToHm(min)}:00${TZ_OFFSET}`;

type Draft = Omit<BookingSeedRow, 'id'>;
type Rng = ReturnType<typeof createRng>;

/** Book inside one contiguous working window until the minute budget for the target is consumed. */
function fillWindow(
  windowStart: number,
  windowEnd: number,
  date: string,
  technicianId: string,
  merchantId: string,
  styles: SeedStyle[],
  rng: Rng,
  targetUtilization: number,
): Draft[] {
  const drafts: Draft[] = [];
  const budget = Math.round(Math.max(0, Math.min(1, targetUtilization)) * (windowEnd - windowStart));
  let cursor = windowStart;
  let booked = 0;

  while (booked < budget && cursor + MIN_BOOKABLE <= windowEnd) {
    const fitting = styles.filter((s) => cursor + clampDuration(s.durationMin) <= windowEnd);
    if (fitting.length === 0) break;
    const chosen = fitting[rng.int(0, fitting.length - 1)];
    const dur = clampDuration(chosen.durationMin);
    drafts.push({
      merchantId,
      technicianId,
      customerName: CUSTOMERS[rng.int(0, CUSTOMERS.length - 1)],
      styleTitle: chosen.title,
      styleImageUrl: '',
      startAt: isoAt(date, cursor),
      endAt: isoAt(date, cursor + dur),
      durationMin: dur,
      status: 'confirmed',
    });
    booked += dur;
    cursor += dur;
    // Scatter slack so leftover capacity is FRAGMENTED (fragment-fit must vary) rather than pooled into
    // one block at day's end — but only when the remaining room can still absorb the outstanding budget.
    // Without this guard a higher target inserts more gaps and books LESS, breaking monotonicity.
    const outstanding = budget - booked;
    const gap = 15;
    if (outstanding > 0 && windowEnd - cursor - gap >= outstanding) cursor += rng.int(0, 1) * gap;
  }
  return drafts;
}

export function generateRollingBookings(input: {
  dates: string[]; // next 7 local YYYY-MM-DD (merchant tz)
  technicianIds: string[];
  merchantId: string;
  styles: SeedStyle[];
  seed?: number;
  /** Fraction of next week's working minutes to book (0..1). Default 0.35 (idle). */
  targetUtilization?: number;
}): BookingSeedRow[] {
  const rng = createRng(input.seed ?? 20_260_709);
  const baseTarget = input.targetUtilization ?? CAPACITY_SCENARIOS.idle.targetUtilization;
  const styles = input.styles.length > 0 ? input.styles : [{ title: '法式', durationMin: 60 }];

  const drafts: Draft[] = [];
  input.dates.forEach((date, di) => {
    input.technicianIds.forEach((techId, ti) => {
      // Vary the load ±12% across techs/days so utilization and gaps differ (some techs busier).
      const target = baseTarget * (0.88 + 0.12 * ((ti + di) % 3));
      drafts.push(...fillWindow(OPEN, BREAK_START, date, techId, input.merchantId, styles, rng, target));
      drafts.push(...fillWindow(BREAK_END, CLOSE, date, techId, input.merchantId, styles, rng, target));
    });
  });

  // Stable ids (same seed + dates → same ids) so the seed is idempotent via upsert.
  return drafts.map((d, i) => ({ id: `capseed-${i}`, ...d }));
}
