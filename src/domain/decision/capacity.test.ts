import { describe, expect, it } from 'vitest';
import { computeCapacity, type BusyInterval, type CapacityDay } from './capacity';
import type { WorkingPlanDay, Weekday } from '../scheduling';

// One tech, one day (weekday 1), 10:00–19:00 (600–1140) with a 13:00–14:00 break → 480 net minutes.
const plan: WorkingPlanDay = { technicianId: 't1', weekday: 1 as Weekday, openMin: 600, closeMin: 1140, breaks: [{ startMin: 780, endMin: 840 }] };
const days: CapacityDay[] = [{ date: '2026-07-06', weekday: 1 as Weekday }];

describe('computeCapacity', () => {
  it('sums net working minutes (window minus breaks) and is fully free when unbooked', () => {
    const c = computeCapacity({ technicianIds: ['t1'], workingPlans: [plan], busy: [], days, styleDurationMin: 60 });
    expect(c.totalMin).toBe(480);
    expect(c.remainingMin).toBe(480);
    expect(c.utilizationPct).toBe(0);
    expect(c.band).toBe('very_idle');
  });

  it('counts booked minutes (clamped to working segments) and reports the band', () => {
    // 10:00–13:00 (180) before the break + 14:00–18:00 (240) after = 420 booked of 480 net.
    const busy: BusyInterval[] = [
      { technicianId: 't1', date: '2026-07-06', startMin: 600, endMin: 780 },
      { technicianId: 't1', date: '2026-07-06', startMin: 840, endMin: 1080 },
    ];
    const c = computeCapacity({ technicianIds: ['t1'], workingPlans: [plan], busy, days, styleDurationMin: 60 });
    expect(c.busyMin).toBe(420);
    expect(c.utilizationPct).toBe(88); // 420/480
    expect(c.band).toBe('near_full');
  });

  it('fragment-fit: a long style does not fit into small gaps even if total free is large', () => {
    // Book the morning + afternoon so only the 60-min post-break slot before the next booking is free.
    const busy: BusyInterval[] = [
      { technicianId: 't1', date: '2026-07-06', startMin: 600, endMin: 780 }, // 10:00–13:00 (break 13-14)
      { technicianId: 't1', date: '2026-07-06', startMin: 900, endMin: 1140 }, // 15:00–19:00
    ];
    // Free = 14:00–15:00 = 60 min only. Total free 60.
    const c = computeCapacity({ technicianIds: ['t1'], workingPlans: [plan], busy, days, styleDurationMin: 150 });
    expect(c.remainingMin).toBe(60);
    expect(c.largestGapMin).toBe(60);
    expect(c.fitsStyle).toBe(false); // 150-min style can't fit a 60-min gap
    // a 45-min style would fit
    expect(computeCapacity({ technicianIds: ['t1'], workingPlans: [plan], busy, days, styleDurationMin: 45 }).fitsStyle).toBe(true);
  });

  it('skips days a tech has no plan for', () => {
    const c = computeCapacity({ technicianIds: ['t1'], workingPlans: [plan], busy: [], days: [{ date: '2026-07-07', weekday: 2 as Weekday }], styleDurationMin: 60 });
    expect(c.totalMin).toBe(0);
  });
});
