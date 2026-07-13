// Decision brain — T3: next-week capacity (ADR-0012 Phase 1, PM spec steps 4 & Capacity-Fit).
// Pure interval math. The caller resolves each technician's working plan (with breaks), bookings, and
// blocked time into local-minute intervals per (technician, date) so this stays timezone-free and testable.
// Output: utilization band (drives the discount gate) + FRAGMENT-FIT — a 150-min style must not be
// "recommended" into a week that only has 45-min gaps, even if total free minutes look large.

import type { Weekday, WorkingPlanDay, LocalMinuteRange } from '../scheduling';

export type CapacityDay = { date: string; weekday: Weekday };
/** A busy block on a technician's day, in local minutes (bookings + blocked time, cancelled excluded). */
export type BusyInterval = { technicianId: string; date: string; startMin: number; endMin: number };

export type CapacityBand = 'very_idle' | 'normal' | 'near_full' | 'full';
export type Capacity = {
  totalMin: number; // net working minutes (window minus breaks) across all tech-days next week
  busyMin: number; // booked + blocked minutes inside working windows
  remainingMin: number;
  utilizationPct: number; // 0..100
  band: CapacityBand;
  largestGapMin: number; // biggest contiguous free block anywhere next week
  fitsStyle: boolean; // largestGapMin >= the style's duration
};

function bandFor(utilPct: number): CapacityBand {
  if (utilPct < 60) return 'very_idle';
  if (utilPct < 80) return 'normal';
  if (utilPct <= 90) return 'near_full';
  return 'full';
}

/** Subtract breaks from [open,close) → net working segments (minute ranges). */
function netWorkingSegments(plan: WorkingPlanDay): LocalMinuteRange[] {
  let segments: LocalMinuteRange[] = [{ startMin: plan.openMin, endMin: plan.closeMin }];
  for (const brk of plan.breaks) {
    segments = segments.flatMap((seg) => {
      if (brk.endMin <= seg.startMin || brk.startMin >= seg.endMin) return [seg];
      const out: LocalMinuteRange[] = [];
      if (brk.startMin > seg.startMin) out.push({ startMin: seg.startMin, endMin: brk.startMin });
      if (brk.endMin < seg.endMin) out.push({ startMin: brk.endMin, endMin: seg.endMin });
      return out;
    });
  }
  return segments.filter((s) => s.endMin > s.startMin);
}

/** Free gaps inside a working segment after removing busy intervals (sorted, merged as we go). */
function freeGaps(segment: LocalMinuteRange, busy: Array<{ startMin: number; endMin: number }>): LocalMinuteRange[] {
  const within = busy
    .map((b) => ({ startMin: Math.max(b.startMin, segment.startMin), endMin: Math.min(b.endMin, segment.endMin) }))
    .filter((b) => b.endMin > b.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  const gaps: LocalMinuteRange[] = [];
  let cursor = segment.startMin;
  for (const b of within) {
    if (b.startMin > cursor) gaps.push({ startMin: cursor, endMin: b.startMin });
    cursor = Math.max(cursor, b.endMin);
  }
  if (cursor < segment.endMin) gaps.push({ startMin: cursor, endMin: segment.endMin });
  return gaps;
}

const len = (r: LocalMinuteRange): number => r.endMin - r.startMin;

export function computeCapacity(input: {
  technicianIds: string[];
  workingPlans: WorkingPlanDay[];
  busy: BusyInterval[];
  days: CapacityDay[];
  styleDurationMin: number;
}): Capacity {
  let totalMin = 0;
  let freeMin = 0;
  let largestGapMin = 0;

  for (const techId of input.technicianIds) {
    for (const day of input.days) {
      const plan = input.workingPlans.find((p) => p.technicianId === techId && p.weekday === day.weekday);
      if (!plan) continue; // not scheduled that day
      const dayBusy = input.busy.filter((b) => b.technicianId === techId && b.date === day.date);
      for (const seg of netWorkingSegments(plan)) {
        totalMin += len(seg);
        for (const gap of freeGaps(seg, dayBusy)) {
          const g = len(gap);
          freeMin += g;
          if (g > largestGapMin) largestGapMin = g;
        }
      }
    }
  }

  const busyMin = Math.max(0, totalMin - freeMin);
  const utilizationPct = totalMin > 0 ? Math.round((busyMin / totalMin) * 100) : 0;
  return {
    totalMin,
    busyMin,
    remainingMin: freeMin,
    utilizationPct,
    band: bandFor(utilizationPct),
    largestGapMin,
    fitsStyle: largestGapMin >= input.styleDurationMin,
  };
}
