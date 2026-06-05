import { describe, expect, it } from 'vitest';
import type { Technician } from './nail';
import {
  findAvailableTechnicians,
  intervalsOverlap,
  isTechnicianFree,
  isWithinWorkingPlan,
  type MsInterval,
  type WorkingPlanDay,
} from './scheduling';
import { mockBlockedTimes, mockWorkingPlans } from '@/mock/scheduling';
import { mockTechnicians } from '@/mock/technicians';

// All concrete instants anchored to Monday 2026-06-08, Asia/Singapore (+08:00).
function sgt(time: string): number {
  return new Date(`2026-06-08T${time}:00+08:00`).getTime();
}
function interval(start: string, end: string): MsInterval {
  return { startMs: sgt(start), endMs: sgt(end) };
}
const hm = (h: number, m = 0) => h * 60 + m;

describe('intervalsOverlap', () => {
  it('touching at an endpoint does NOT overlap (half-open)', () => {
    expect(intervalsOverlap(interval('10:00', '11:00'), interval('11:00', '12:00'))).toBe(false);
  });
  it('partial overlap is detected', () => {
    expect(intervalsOverlap(interval('10:00', '11:00'), interval('10:30', '11:30'))).toBe(true);
  });
  it('fully contained overlaps', () => {
    expect(intervalsOverlap(interval('10:00', '12:00'), interval('10:30', '11:00'))).toBe(true);
  });
  it('disjoint does not overlap', () => {
    expect(intervalsOverlap(interval('10:00', '11:00'), interval('14:00', '15:00'))).toBe(false);
  });
});

describe('isWithinWorkingPlan', () => {
  const plan: WorkingPlanDay = {
    technicianId: 'tech-x',
    weekday: 1,
    openMin: hm(10),
    closeMin: hm(19),
    breaks: [{ startMin: hm(13), endMin: hm(14) }],
  };

  it('a window inside open hours and clear of breaks fits', () => {
    expect(isWithinWorkingPlan({ startMin: hm(15), endMin: hm(16) }, plan)).toBe(true);
  });
  it('a window flush against the open boundary fits', () => {
    expect(isWithinWorkingPlan({ startMin: hm(10), endMin: hm(11) }, plan)).toBe(true);
  });
  it('a window flush against the close boundary fits', () => {
    expect(isWithinWorkingPlan({ startMin: hm(18), endMin: hm(19) }, plan)).toBe(true);
  });
  it('a window starting before open does not fit', () => {
    expect(isWithinWorkingPlan({ startMin: hm(9, 30), endMin: hm(10, 30) }, plan)).toBe(false);
  });
  it('a window ending after close does not fit', () => {
    expect(isWithinWorkingPlan({ startMin: hm(18, 30), endMin: hm(19, 30) }, plan)).toBe(false);
  });
  it('a window overlapping a break does not fit', () => {
    expect(isWithinWorkingPlan({ startMin: hm(13, 30), endMin: hm(14, 30) }, plan)).toBe(false);
  });
  it('a window flush against a break boundary fits', () => {
    expect(isWithinWorkingPlan({ startMin: hm(14), endMin: hm(15) }, plan)).toBe(true);
  });
  it('rejects an inverted window (fail closed)', () => {
    expect(isWithinWorkingPlan({ startMin: hm(16), endMin: hm(15) }, plan)).toBe(false);
  });
  it('rejects a zero-length window (fail closed)', () => {
    expect(isWithinWorkingPlan({ startMin: hm(15), endMin: hm(15) }, plan)).toBe(false);
  });
});

describe('isTechnicianFree', () => {
  it('is free when no busy interval overlaps', () => {
    expect(isTechnicianFree(interval('15:00', '16:00'), [interval('10:00', '11:00')])).toBe(true);
  });
  it('is not free when a busy interval overlaps', () => {
    expect(isTechnicianFree(interval('15:00', '16:00'), [interval('14:00', '16:15')])).toBe(false);
  });
});

describe('findAvailableTechnicians (Monday 2026-06-08)', () => {
  const base = {
    technicians: mockTechnicians,
    workingPlans: mockWorkingPlans,
    blockedTimes: mockBlockedTimes,
  };
  const mondayRequest = {
    weekday: 1 as const,
    localRange: { startMin: hm(15), endMin: hm(16) },
    interval: interval('15:00', '16:00'),
  };

  it('excludes a technician with no plan for the day (Anna is closed Mondays)', () => {
    const ids = findAvailableTechnicians({ ...base, existingByTechnician: {}, request: mondayRequest }).map(
      (t) => t.id,
    );
    expect(ids).not.toContain('tech-anna');
  });

  it('excludes a technician blocked at the requested time (Mei: 15:00–17:00 training)', () => {
    const ids = findAvailableTechnicians({ ...base, existingByTechnician: {}, request: mondayRequest }).map(
      (t) => t.id,
    );
    expect(ids).not.toContain('tech-mei');
  });

  it('includes a working, unblocked, unbooked technician (Lina)', () => {
    const ids = findAvailableTechnicians({ ...base, existingByTechnician: {}, request: mondayRequest }).map(
      (t) => t.id,
    );
    expect(ids).toEqual(['tech-lina']);
  });

  it('DURATION REGRESSION: a 135-min booking (14:00–16:15) blocks an overlapping 15:00 start', () => {
    const ids = findAvailableTechnicians({
      ...base,
      existingByTechnician: { 'tech-lina': [interval('14:00', '16:15')] },
      request: mondayRequest,
    }).map((t) => t.id);
    // The old slot-string check (date+time equality) would have left Lina available here.
    expect(ids).not.toContain('tech-lina');
  });

  it('frees the technician once the requested start clears the prior booking end', () => {
    const ids = findAvailableTechnicians({
      ...base,
      existingByTechnician: { 'tech-lina': [interval('14:00', '16:15')] },
      request: {
        weekday: 1 as const,
        localRange: { startMin: hm(16, 30), endMin: hm(17, 30) },
        interval: interval('16:30', '17:30'),
      },
    }).map((t) => t.id);
    expect(ids).toContain('tech-lina');
  });

  it('returns nobody for a malformed (zero-length) request, never everybody', () => {
    const result = findAvailableTechnicians({
      ...base,
      existingByTechnician: {},
      request: {
        weekday: 1 as const,
        localRange: { startMin: hm(15), endMin: hm(15) },
        interval: { startMs: sgt('15:00'), endMs: sgt('15:00') },
      },
    });
    expect(result).toEqual([]);
  });

  it('excludes inactive technicians', () => {
    const withInactive: Technician[] = [
      ...mockTechnicians,
      { id: 'tech-off', name: 'Off Duty', initials: 'OD', title: 'On leave', active: false },
    ];
    const ids = findAvailableTechnicians({
      technicians: withInactive,
      workingPlans: [
        ...mockWorkingPlans,
        { technicianId: 'tech-off', weekday: 1, openMin: hm(10), closeMin: hm(19), breaks: [] },
      ],
      blockedTimes: mockBlockedTimes,
      existingByTechnician: {},
      request: mondayRequest,
    }).map((t) => t.id);
    expect(ids).not.toContain('tech-off');
  });
});
