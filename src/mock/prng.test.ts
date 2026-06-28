import { describe, expect, it } from 'vitest';
import { createRng } from './prng';

describe('createRng', () => {
  it('is reproducible — same seed yields the same sequence', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds diverge', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  function mean(rng: { next(): number }, draw: () => number, n = 4000): number {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += draw();
    return s / n;
  }

  it('beta(α,β) mean ≈ α/(α+β)', () => {
    const r = createRng(7);
    expect(mean(r, () => r.beta(2, 8))).toBeCloseTo(0.2, 1); // 2/10
  });

  it('poisson(λ) mean ≈ λ', () => {
    const r = createRng(7);
    expect(mean(r, () => r.poisson(5))).toBeCloseTo(5, 0);
  });

  it('binomial(n,p) mean ≈ n·p', () => {
    const r = createRng(7);
    expect(mean(r, () => r.binomial(20, 0.25))).toBeCloseTo(5, 0);
  });

  it('weighted respects weights', () => {
    const r = createRng(7);
    let a = 0;
    for (let i = 0; i < 2000; i += 1) if (r.weighted([['a', 3], ['b', 1]] as const) === 'a') a += 1;
    expect(a / 2000).toBeCloseTo(0.75, 1);
  });
});
