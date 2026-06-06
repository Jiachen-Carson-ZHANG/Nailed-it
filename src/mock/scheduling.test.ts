import { describe, expect, it } from 'vitest';
import { mockTechnicians } from './technicians';
import { mockBlockedTimes, mockWorkingPlans } from './scheduling';

describe('working plan data integrity', () => {
  it('every plan references a known technician', () => {
    const ids = new Set(mockTechnicians.map((t) => t.id));
    const orphans = mockWorkingPlans.filter((p) => !ids.has(p.technicianId));
    expect(orphans.map((p) => `${p.technicianId}/${p.weekday}`)).toEqual([]);
  });

  it('weekday is 0..6 and is unique per technician', () => {
    const bad: string[] = [];
    const seen = new Set<string>();
    for (const p of mockWorkingPlans) {
      if (p.weekday < 0 || p.weekday > 6) bad.push(`${p.technicianId} weekday ${p.weekday}`);
      const key = `${p.technicianId}/${p.weekday}`;
      if (seen.has(key)) bad.push(`duplicate ${key}`);
      seen.add(key);
    }
    expect(bad).toEqual([]);
  });

  it('open < close, within a single day, and breaks sit inside the open window', () => {
    const bad: string[] = [];
    for (const p of mockWorkingPlans) {
      if (!(p.openMin >= 0 && p.openMin < p.closeMin && p.closeMin <= 1440)) {
        bad.push(`${p.technicianId}/${p.weekday} bad window ${p.openMin}-${p.closeMin}`);
      }
      for (const b of p.breaks) {
        if (!(b.startMin < b.endMin && b.startMin >= p.openMin && b.endMin <= p.closeMin)) {
          bad.push(`${p.technicianId}/${p.weekday} bad break ${b.startMin}-${b.endMin}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('blocked time data integrity', () => {
  it('has unique ids and references known technicians', () => {
    const ids = mockBlockedTimes.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const techIds = new Set(mockTechnicians.map((t) => t.id));
    expect(mockBlockedTimes.filter((b) => !techIds.has(b.technicianId)).map((b) => b.id)).toEqual([]);
  });

  it('start is a valid instant strictly before end', () => {
    const bad = mockBlockedTimes.filter((b) => {
      const start = new Date(b.startAt).getTime();
      const end = new Date(b.endAt).getTime();
      return !Number.isFinite(start) || !Number.isFinite(end) || start >= end;
    });
    expect(bad.map((b) => b.id)).toEqual([]);
  });
});
