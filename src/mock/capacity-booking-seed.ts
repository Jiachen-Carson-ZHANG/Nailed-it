// Synthetic capacity data (ADR-0012 Phase 2). The funnel seed (intelligence-seed) writes booking_confirmed
// *events* (a conversion count); the decision brain's capacity gate needs real *interval bookings* in the
// NEXT 7 DAYS. Those were missing — mockIntervalBookings are historical — so a live test read the salon as
// 100% idle and the agent over-recommended discounts. This generator fills the coming week with a realistic,
// reproducible partial load (some technicians busier than others → varied utilization + fragment gaps).
//
// Pure + deterministic (seeded PRNG). No overlaps per technician (cursor advances past each appointment,
// and the day is split around the standard 13:00–14:00 break). Rolling: dates are passed in, computed from
// "now" at seed time, so the data never goes stale.

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
const GAP = 15; // buffer between appointments (min)
const MIN_BOOKABLE = 45;
const TZ_OFFSET = '+08:00'; // demo merchant (Asia/Singapore, no DST)
const CUSTOMERS = ['Grace', 'Ivy', 'Nina', 'Cara', 'Bea', 'Joy', 'Wen', 'Mia', 'Sara', 'Lulu'];

const pad = (n: number): string => String(n).padStart(2, '0');
const minToHm = (m: number): string => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const isoAt = (date: string, min: number): string => `${date}T${minToHm(min)}:00${TZ_OFFSET}`;

type Draft = Omit<BookingSeedRow, 'id'>;
type Rng = ReturnType<typeof createRng>;

function fillWindow(
  windowStart: number,
  windowEnd: number,
  date: string,
  technicianId: string,
  merchantId: string,
  styles: SeedStyle[],
  rng: Rng,
  fillProbability: number,
  gapMin: number,
): Draft[] {
  const drafts: Draft[] = [];
  let cursor = windowStart;
  while (cursor + MIN_BOOKABLE <= windowEnd) {
    if (rng.next() < fillProbability) {
      const style = styles[rng.int(0, styles.length - 1)];
      const dur = Math.max(MIN_BOOKABLE, Math.min(150, style.durationMin || 60));
      if (cursor + dur > windowEnd) break; // won't fit the rest of this window
      drafts.push({
        merchantId,
        technicianId,
        customerName: CUSTOMERS[rng.int(0, CUSTOMERS.length - 1)],
        styleTitle: style.title,
        styleImageUrl: '',
        startAt: isoAt(date, cursor),
        endAt: isoAt(date, cursor + dur),
        durationMin: dur,
        status: 'confirmed',
      });
      cursor += dur + gapMin;
    } else {
      cursor += 30; // skip a slot → leaves gaps, so fragment-fit varies
    }
  }
  return drafts;
}

/** Named capacity scenarios — the knob that makes the decision brain's gates actually bite.
 *  coupon is gated above 70% utilization, ad above 85% (see domain/decision/decision.ts). */
export const CAPACITY_SCENARIOS = {
  idle: { fillProbability: 0.45, gapMin: 20 }, // ~30-40% → coupons + ads both allowed
  busy: { fillProbability: 0.85, gapMin: 10 }, // ~70-80% → coupons gated, ads still allowed
  full: { fillProbability: 1.0, gapMin: 0 }, //  ~90%+  → both gated: no discounting into a full week
} as const;
export type CapacityScenario = keyof typeof CAPACITY_SCENARIOS;

export function generateRollingBookings(input: {
  dates: string[]; // next 7 local YYYY-MM-DD (merchant tz)
  technicianIds: string[];
  merchantId: string;
  styles: SeedStyle[];
  seed?: number;
  fillProbability?: number; // baseline per-tech fill (default 0.5)
  gapMin?: number; // buffer between appointments (default 15) — smaller packs the week tighter
}): BookingSeedRow[] {
  const rng = createRng(input.seed ?? 20_260_709);
  const baseFill = input.fillProbability ?? 0.5;
  const gapMin = input.gapMin ?? GAP;
  const styles = input.styles.length > 0 ? input.styles : [{ title: '法式', durationMin: 60 }];

  const drafts: Draft[] = [];
  input.dates.forEach((date, di) => {
    input.technicianIds.forEach((techId, ti) => {
      // Vary the load so utilization + gaps differ across techs/days (0.55x .. 1.05x of baseline).
      const fill = baseFill * (0.55 + 0.25 * ((ti + di) % 3));
      drafts.push(...fillWindow(OPEN, BREAK_START, date, techId, input.merchantId, styles, rng, fill, gapMin));
      drafts.push(...fillWindow(BREAK_END, CLOSE, date, techId, input.merchantId, styles, rng, fill, gapMin));
    });
  });

  // Stable ids (same seed + dates → same ids) so the seed is idempotent via upsert.
  return drafts.map((d, i) => ({ id: `capseed-${i}`, ...d }));
}
