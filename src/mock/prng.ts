// Seeded PRNG + distribution samplers for synthetic demo data (design spec 2026-06-27 §2/§9).
//
// Why: the demo data must be REPRODUCIBLE (same seed → identical dataset every run) yet ORGANIC
// (sampled from distributions, not round hand-picked numbers, so winners/losers have fuzzy edges).
// A seeded generator gives both. No deps — small, pure, deterministic. `Math.random` is intentionally
// NOT used (it would break reproducibility and is banned in parts of the codebase).
//
// Samplers: uniform, int, gaussian (Box–Muller), gamma (Marsaglia–Tsang), beta, poisson (Knuth),
// binomial, weighted pick. Beta is for rates (ctr/cvr…), Poisson for counts (exposure), binomial for
// the funnel chain (clicks ~ Binomial(impressions, ctr)).

export type Rng = {
  /** next float in [0, 1) */
  next(): number;
  uniform(min: number, max: number): number;
  int(minInclusive: number, maxInclusive: number): number;
  gaussian(): number;
  gamma(k: number): number;
  /** rate in (0, 1) */
  beta(alpha: number, beta: number): number;
  /** non-negative count */
  poisson(lambda: number): number;
  binomial(n: number, p: number): number;
  /** pick a value by weight from [value, weight] entries */
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T;
};

/** mulberry32 — fast, decent-quality seeded uint32 → float generator. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);

  function gaussian(): number {
    const u1 = Math.max(next(), 1e-12);
    const u2 = next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // Marsaglia–Tsang gamma sampler (shape k > 0, scale 1).
  function gamma(k: number): number {
    if (k < 1) return gamma(k + 1) * Math.pow(Math.max(next(), 1e-12), 1 / k);
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    // bounded loop guard — converges in ~1–2 iters in practice
    for (let i = 0; i < 1000; i += 1) {
      let x: number;
      let v: number;
      do {
        x = gaussian();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = next();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
    return d; // fallback (effectively never hit)
  }

  function beta(alpha: number, b: number): number {
    const x = gamma(alpha);
    const y = gamma(b);
    return x / (x + y);
  }

  function poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= next();
    } while (p > L);
    return k - 1;
  }

  function binomial(n: number, p: number): number {
    if (n <= 0 || p <= 0) return 0;
    if (p >= 1) return n;
    let count = 0;
    for (let i = 0; i < n; i += 1) if (next() < p) count += 1;
    return count;
  }

  function weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
    let r = next() * total;
    for (const [value, w] of entries) {
      r -= Math.max(0, w);
      if (r <= 0) return value;
    }
    return entries[entries.length - 1][0];
  }

  return {
    next,
    uniform: (min, max) => min + next() * (max - min),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    gaussian,
    gamma,
    beta,
    poisson,
    binomial,
    weighted,
  };
}
