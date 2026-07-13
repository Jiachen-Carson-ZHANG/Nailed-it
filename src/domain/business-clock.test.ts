import { describe, expect, it } from 'vitest';
import { getPeriod, revealedPeriods, proceduralPeriod, SPINE_LENGTH } from './business-clock';

describe('business-clock', () => {
  it('reveals the curated spine first: 3 real beats at days 0/3/7, none simulated', () => {
    const spine = revealedPeriods(SPINE_LENGTH);
    expect(spine.map((p) => p.day)).toEqual([0, 3, 7]);
    expect(spine.map((p) => p.tone)).toEqual(['plan', 'measure', 'revise']);
    expect(spine.every((p) => p.simulated === false)).toBe(true);
  });

  it('always reveals at least one period and grows with the count', () => {
    expect(revealedPeriods(0)).toHaveLength(1); // clamped
    expect(revealedPeriods(1)).toHaveLength(1);
    expect(revealedPeriods(6)).toHaveLength(6);
  });

  it('past the spine it never dead-ends: procedural periods are simulated + tagged ambient', () => {
    const first = getPeriod(SPINE_LENGTH);
    expect(first.simulated).toBe(true);
    expect(first.tone).toBe('ambient');
    expect(first.day).toBeGreaterThan(7); // continues past the last spine day
    expect(first.detail['zh-CN']).toContain('模拟');
  });

  it('procedural periods are deterministic (same index → identical content)', () => {
    const a = proceduralPeriod(9);
    const b = proceduralPeriod(9);
    expect(a).toEqual(b);
    // and different indices generally differ
    expect(proceduralPeriod(9).headline.en).not.toBe(proceduralPeriod(20).headline.en);
  });

  it('handles a long-running demo without throwing', () => {
    expect(() => revealedPeriods(500)).not.toThrow();
    expect(revealedPeriods(500)).toHaveLength(500);
  });
});
