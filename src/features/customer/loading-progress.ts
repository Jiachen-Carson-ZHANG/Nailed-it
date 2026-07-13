/**
 * Fake loading progress curve (0–100), decoupled from real AI progress.
 * - 0 → 90 over ~15s with an ease-out feel (fast then slow).
 * - 90 → asymptotically approaches (but never reaches) 95.
 * - When `done`, jumps straight to 100.
 * Pure function: safe to unit-test and call every rAF tick.
 */
export function computeFakeProgress(elapsedMs: number, done: boolean): number {
  if (done) return 100;

  const RAMP_MS = 15_000; // time to reach ~90%
  const t = Math.max(0, elapsedMs);

  if (t <= RAMP_MS) {
    // ease-out: fast start, slow finish, hits 90 at RAMP_MS
    const x = t / RAMP_MS;          // 0..1
    const eased = 1 - Math.pow(1 - x, 2); // easeOutQuad
    return eased * 90;
  }

  // after ramp: asymptote from 90 toward 95, never crossing it
  const over = t - RAMP_MS;
  const approach = 1 - Math.exp(-over / 20_000); // 0..1 slowly
  return 90 + approach * 5; // 90 → <95
}
