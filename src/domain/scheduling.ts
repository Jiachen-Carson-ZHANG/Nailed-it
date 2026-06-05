// Staff scheduling + interval availability — see ADR-0005 (P3).
//
// This is the duration-aware replacement for the slot-string occupancy check in
// src/domain/availability.ts (which keys on date+time and ignores duration, so a long
// booking does not block an overlapping later start). The kernel here is pure and
// timezone-agnostic: the caller resolves concrete datetimes into the three forms the
// functions need (weekday, local-minute range, epoch-ms interval). Blocked times are
// absolute ISO instants and are resolved to ms inside this module.
//
// Weekday convention: JS Date.getDay() — 0=Sunday … 6=Saturday.

import type { Technician, TechnicianSnapshot } from './nail';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A window in minutes from local midnight, e.g. 600 = 10:00, 1140 = 19:00. Half-open [startMin, endMin). */
export type LocalMinuteRange = { startMin: number; endMin: number };

/** An absolute instant interval in epoch milliseconds. Half-open [startMs, endMs). */
export type MsInterval = { startMs: number; endMs: number };

/** One technician's recurring hours for one weekday, with optional mid-day breaks. */
export type WorkingPlanDay = {
  technicianId: string;
  weekday: Weekday;
  openMin: number;
  closeMin: number;
  breaks: LocalMinuteRange[];
};

/** A one-off block on a technician's calendar (training, leave, etc.). Absolute instants. */
export type BlockedTime = {
  id: string;
  technicianId: string;
  startAt: string;
  endAt: string;
  reason: string;
};

/** Per-staff duration override for a catalog item (duration_config_level='staff_level'). */
export type StaffItemDuration = {
  technicianId: string;
  catalogItemId: string;
  durationMin: number;
};

export type AvailabilityRequest = {
  weekday: Weekday;
  localRange: LocalMinuteRange;
  interval: MsInterval;
};

export type FindAvailableTechniciansInput = {
  technicians: Technician[];
  workingPlans: WorkingPlanDay[];
  blockedTimes: BlockedTime[];
  /** Existing bookings already resolved to ms intervals, keyed by technician id. */
  existingByTechnician: Record<string, MsInterval[]>;
  request: AvailabilityRequest;
};

/** Half-open overlap on any consistent numeric axis (ms or minutes). */
function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** A range is valid only if both ends are finite and start strictly precedes end. */
export function isValidRange(start: number, end: number): boolean {
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
}

/** Two absolute instant intervals overlap. Touching at an endpoint does NOT overlap.
 *  Fails closed: an invalid (inverted/zero/non-finite) interval overlaps nothing. */
export function intervalsOverlap(a: MsInterval, b: MsInterval): boolean {
  if (!isValidRange(a.startMs, a.endMs) || !isValidRange(b.startMs, b.endMs)) {
    return false;
  }
  return rangesOverlap(a.startMs, a.endMs, b.startMs, b.endMs);
}

/** A requested local-minute window fits inside open hours and clears every break. */
export function isWithinWorkingPlan(range: LocalMinuteRange, plan: WorkingPlanDay): boolean {
  // Fail closed on a zero-length, inverted, or non-finite window.
  if (!isValidRange(range.startMin, range.endMin)) {
    return false;
  }
  if (range.startMin < plan.openMin || range.endMin > plan.closeMin) {
    return false;
  }
  return !plan.breaks.some((b) => rangesOverlap(range.startMin, range.endMin, b.startMin, b.endMin));
}

function blockedTimeToInterval(b: BlockedTime): MsInterval {
  return { startMs: new Date(b.startAt).getTime(), endMs: new Date(b.endAt).getTime() };
}

/** A requested ms interval clears every busy interval (existing bookings + blocks). */
export function isTechnicianFree(request: MsInterval, busy: MsInterval[]): boolean {
  return !busy.some((b) => intervalsOverlap(request, b));
}

/**
 * Active technicians who (a) have working hours covering the requested weekday/window and
 * (b) have no booking or block overlapping the requested interval. Pure: no clock, no TZ.
 */
export function findAvailableTechnicians(input: FindAvailableTechniciansInput): TechnicianSnapshot[] {
  const { technicians, workingPlans, blockedTimes, existingByTechnician, request } = input;

  // Fail closed on a malformed request rather than reporting everyone as free
  // (a zero-length ms interval would otherwise overlap nothing).
  if (
    !isValidRange(request.localRange.startMin, request.localRange.endMin) ||
    !isValidRange(request.interval.startMs, request.interval.endMs)
  ) {
    return [];
  }

  return technicians
    .filter((tech) => tech.active)
    .filter((tech) => {
      const plan = workingPlans.find(
        (p) => p.technicianId === tech.id && p.weekday === request.weekday,
      );
      if (!plan || !isWithinWorkingPlan(request.localRange, plan)) {
        return false;
      }
      const busy: MsInterval[] = [
        ...(existingByTechnician[tech.id] ?? []),
        ...blockedTimes.filter((b) => b.technicianId === tech.id).map(blockedTimeToInterval),
      ];
      return isTechnicianFree(request.interval, busy);
    })
    .map((tech) => ({ id: tech.id, name: tech.name, initials: tech.initials }));
}
