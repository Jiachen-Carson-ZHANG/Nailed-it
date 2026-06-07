// Shared formatting for the insights charts. Honest-rule helpers (ADR-0006 addendum).

/** Whole-percent string for a 0..1 rate. */
export function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Bar width as a percent string, clamped to [0, 100], relative to a max. */
export function widthPct(value: number, max: number): string {
  if (max <= 0) return '0%';
  return `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
}
