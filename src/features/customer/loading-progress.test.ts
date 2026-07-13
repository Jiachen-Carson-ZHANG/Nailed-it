import { describe, it, expect } from 'vitest';
import { computeFakeProgress } from './loading-progress';

describe('computeFakeProgress', () => {
  it('starts at 0 at elapsed 0', () => {
    expect(computeFakeProgress(0, false)).toBe(0);
  });

  it('reaches ~90 by 15s (within tolerance)', () => {
    const p = computeFakeProgress(15_000, false);
    expect(p).toBeGreaterThanOrEqual(88);
    expect(p).toBeLessThanOrEqual(90);
  });

  it('asymptotes below 95 no matter how long', () => {
    expect(computeFakeProgress(60_000, false)).toBeLessThan(95);
    expect(computeFakeProgress(600_000, false)).toBeLessThan(95);
  });

  it('is monotonically non-decreasing over the pre-done range', () => {
    let prev = -1;
    for (let t = 0; t <= 60_000; t += 500) {
      const p = computeFakeProgress(t, false);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('returns 100 immediately when done is true', () => {
    expect(computeFakeProgress(0, true)).toBe(100);
    expect(computeFakeProgress(3_000, true)).toBe(100);
  });
});
