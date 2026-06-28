// Per-style latent funnel parameters for the hero merchant (design spec 2026-06-27 §7).
//
// These are the HIDDEN quality knobs the generator samples from — NOT hardcoded counts. Each style's
// funnel (impressions→clicks→details→try-ons→bookings) is drawn from these via the seeded PRNG, so the
// data is organic (fuzzy edges) yet reproducible. Rates are Beta(α,β); exposure is Poisson(λ).
//
// Only the scenario styles override the priors; everything else uses PRIOR (the realistic middle mass).
// The scenarios are SITUATIONS, not verdicts — the agent decides what to do at runtime (§3).

export type Rate = readonly [alpha: number, beta: number];

export type StyleLatent = {
  /** mean exposure (Poisson λ) */
  lambda: number;
  ctr: Rate; // P(click | impression)
  detailR: Rate; // P(detail | click)
  tryR: Rate; // P(try-on | detail)
  cvr: Rate; // P(booking | try-on) — the core "quality"
  savR: Rate; // P(save | click)
  /** time weighting of events across the 14-day window */
  ramp?: 'up' | 'down';
  /** volume-booking price (named users set their own) */
  price?: number;
  /** doc reference (§3 scenario) */
  scenario?: string;
};

/** The realistic middle: most styles cluster here. mean ctr≈.22, detail≈.43, try≈.26, cvr≈.20. */
export const PRIOR: StyleLatent = {
  lambda: 48,
  ctr: [2.5, 9],
  detailR: [3, 4],
  tryR: [2.5, 7],
  cvr: [2, 8],
  savR: [2, 12],
  price: 85,
};

// Scenario styles (ids are the real Phase-0 hero styles, so facets already exist).
export const STYLE_LATENTS: Record<string, StyleLatent> = {
  // Clear winner — strong all the way down, on the rising 金属感-adjacent feed. cvr ≈ .55.
  'style-melissa-img-8265': {
    lambda: 120, ctr: [6, 8], detailR: [6, 4], tryR: [5, 6], cvr: [9, 7], savR: [2, 10],
    ramp: 'up', price: 95, scenario: 'winner',
  },
  // High-interest, low-conversion — heavy funnel, cliff at booking. cvr ≈ .02 (price suspect).
  // High λ + rates so try-ons robustly clear the high-interest threshold (≥8); cvr near-zero → bk ≤1.
  'style-melissa-img-8284': {
    lambda: 160, ctr: [7, 7], detailR: [7, 5], tryR: [7, 6], cvr: [1, 40], savR: [3, 8],
    ramp: 'up', price: 120, scenario: 'low-conversion',
  },
  // Declining star (金属感) — was hot, ramps down late. cvr ≈ .38.
  'style-melissa-img-8282': {
    lambda: 90, ctr: [4, 7], detailR: [3, 4], tryR: [3, 6], cvr: [3, 5], savR: [2, 10],
    ramp: 'down', price: 110, scenario: 'declining-star',
  },
  // Vanity trap — high saves, low conversion. save ≈ .57, cvr ≈ .05.
  'style-melissa-img-8273': {
    lambda: 80, ctr: [5, 7], detailR: [3, 5], tryR: [2, 8], cvr: [1, 18], savR: [8, 6],
    price: 85, scenario: 'vanity-trap',
  },
  // 金属感 background (rising tag), modest conversion — must NOT out-rank the winner on a low-volume
  // spike, so cvr is kept clearly below 8265 (≈ .14).
  'style-melissa-img-8274': {
    lambda: 60, ctr: [3, 8], detailR: [3, 4], tryR: [2.5, 7], cvr: [1, 6], savR: [2, 10],
    ramp: 'up', price: 90, scenario: 'metallic-bg',
  },
  // 暗黑 — the gap is on SUPPLY (1 style) + search demand, not the funnel. Thin, ordinary funnel.
  'style-melissa-img-8281': {
    lambda: 40, ctr: [2.5, 9], detailR: [3, 4], tryR: [2.5, 7], cvr: [2, 8], savR: [2, 12],
    price: 80, scenario: 'gap-supply',
  },
  // Under-exposed gem — low exposure, high cvr (≈ .58). Few try-ons (<3) so it slips past the
  // "top converter" volume guard, but its quality-per-try is a signal for the agent to catch.
  'style-melissa-img-8275': {
    lambda: 22, ctr: [3, 8], detailR: [3, 4], tryR: [2, 8], cvr: [7, 5], savR: [2, 10],
    price: 90, scenario: 'under-exposed-gem',
  },
  // Near-tie pair — two mild 法式/甜美 styles, one slightly better (tie-break test).
  'style-melissa-img-8249': {
    lambda: 46, ctr: [3, 8], detailR: [3, 4], tryR: [2.5, 7], cvr: [3, 6], savR: [2, 11],
    price: 75, scenario: 'near-tie-a',
  },
  'style-melissa-img-8266': {
    lambda: 46, ctr: [3, 8], detailR: [3, 4], tryR: [2.5, 7], cvr: [3, 7], savR: [2, 11],
    price: 75, scenario: 'near-tie-b',
  },
  // Dead ×2 — low everything → delist candidates.
  'style-melissa-img-8277': {
    lambda: 15, ctr: [1, 15], detailR: [1, 6], tryR: [1, 10], cvr: [1, 20], savR: [1, 15],
    price: 70, scenario: 'dead',
  },
  'style-melissa-img-8261': {
    lambda: 15, ctr: [1, 14], detailR: [1, 6], tryR: [1, 10], cvr: [1, 20], savR: [1, 15],
    price: 80, scenario: 'dead',
  },
  // 8254 left to PRIOR (the realistic middle).
};

export function latentFor(styleId: string): StyleLatent {
  return STYLE_LATENTS[styleId] ?? PRIOR;
}
