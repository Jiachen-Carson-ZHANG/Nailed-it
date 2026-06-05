import { describe, expect, it } from 'vitest';
import { instantToZonedParts, resolveSlot, zonedWallTimeToUtcMs } from './timezone';

describe('instantToZonedParts (instant → merchant wall clock)', () => {
  it('is the inverse of a Singapore wall-clock slot', () => {
    const ms = Date.parse('2026-06-09T10:00:00+08:00');
    expect(instantToZonedParts(ms, 'Asia/Singapore')).toEqual({ date: '2026-06-09', time: '10:00' });
  });
  it('renders the same instant differently per timezone', () => {
    const ms = Date.parse('2026-06-09T10:00:00+08:00');
    expect(instantToZonedParts(ms, 'UTC')).toEqual({ date: '2026-06-09', time: '02:00' });
  });
});

describe('merchant timezone resolution (gate 5)', () => {
  it('resolves a Singapore wall-clock slot to consistent local + absolute forms', () => {
    const req = resolveSlot('Asia/Singapore', '2026-06-09', '10:00', 90);
    expect(req.localRange).toEqual({ startMin: 600, endMin: 690 });
    expect(req.interval.startMs).toBe(Date.parse('2026-06-09T10:00:00+08:00'));
    expect(req.interval.endMs).toBe(req.interval.startMs + 90 * 60_000);
    // weekday is the merchant-local calendar weekday
    expect(req.weekday).toBe(new Date(Date.UTC(2026, 5, 9)).getUTCDay());
  });

  it('honours the zone offset for the same wall time', () => {
    const sg = zonedWallTimeToUtcMs('2026-06-09', '10:00', 'Asia/Singapore');
    const utc = zonedWallTimeToUtcMs('2026-06-09', '10:00', 'UTC');
    expect(sg).toBe(Date.parse('2026-06-09T10:00:00+08:00'));
    expect(utc).toBe(Date.parse('2026-06-09T10:00:00Z'));
    // 10:00 in Singapore is an earlier absolute instant than 10:00 in UTC (8h ahead).
    expect(sg).toBe(utc - 8 * 60 * 60_000);
  });
});
