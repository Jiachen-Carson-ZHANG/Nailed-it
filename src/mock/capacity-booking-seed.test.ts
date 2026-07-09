import { describe, expect, it } from 'vitest';
import { generateRollingBookings, CAPACITY_SCENARIOS } from './capacity-booking-seed';

const dates = ['2026-07-09', '2026-07-10', '2026-07-11'];
const technicianIds = ['tech-mei', 'tech-lina', 'tech-anna'];
const styles = [{ title: '法式', durationMin: 60 }, { title: '猫眼', durationMin: 90 }, { title: '手绘', durationMin: 150 }];

const toMin = (iso: string): number => {
  const hm = iso.slice(11, 16);
  return Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
};

describe('generateRollingBookings', () => {
  const rows = generateRollingBookings({ dates, technicianIds, merchantId: 'm', styles, fillProbability: 0.8 });

  it('produces a realistic partial load (not empty, not fully packed)', () => {
    expect(rows.length).toBeGreaterThan(0);
    // upper bound: 3 days × 3 techs × ~8 slots is well under this
    expect(rows.length).toBeLessThan(3 * 3 * 12);
  });

  it('places every booking inside working hours and never across the 13:00–14:00 break', () => {
    for (const r of rows) {
      const s = toMin(r.startAt);
      const e = toMin(r.endAt);
      expect(s).toBeGreaterThanOrEqual(600);
      expect(e).toBeLessThanOrEqual(1140);
      // no booking straddles the break window
      expect(s >= 840 || e <= 780).toBe(true);
    }
  });

  it('never double-books a technician on a day (the DB exclusion constraint would reject it)', () => {
    const byTechDay = new Map<string, Array<{ s: number; e: number }>>();
    for (const r of rows) {
      const key = `${r.technicianId}:${r.startAt.slice(0, 10)}`;
      const arr = byTechDay.get(key) ?? [];
      arr.push({ s: toMin(r.startAt), e: toMin(r.endAt) });
      byTechDay.set(key, arr);
    }
    for (const arr of byTechDay.values()) {
      arr.sort((a, b) => a.s - b.s);
      for (let i = 1; i < arr.length; i += 1) expect(arr[i].s).toBeGreaterThanOrEqual(arr[i - 1].e);
    }
  });

  it('is reproducible (same seed → identical ids) and only uses the passed dates', () => {
    const again = generateRollingBookings({ dates, technicianIds, merchantId: 'm', styles, fillProbability: 0.8 });
    expect(again.map((r) => r.id)).toEqual(rows.map((r) => r.id));
    expect(new Set(rows.map((r) => r.startAt.slice(0, 10)))).toEqual(new Set(dates));
  });

  it('capacity scenarios produce strictly increasing load (idle < busy < full)', () => {
    const bookedMin = (s: keyof typeof CAPACITY_SCENARIOS) =>
      generateRollingBookings({ dates, technicianIds, merchantId: 'm', styles, ...CAPACITY_SCENARIOS[s] })
        .reduce((sum, r) => sum + r.durationMin, 0);
    const idle = bookedMin('idle');
    const busy = bookedMin('busy');
    const full = bookedMin('full');
    expect(idle).toBeLessThan(busy);
    expect(busy).toBeLessThan(full);
  });
});
