'use client';

type Props = {
  points: number[];
  /** Accent colour family for the line/area/dot. */
  tone?: 'accent' | 'muted';
  /** Accessible label, e.g. "试戴 近14天". */
  label?: string;
};

const W = 100;
const H = 28;
const PAD = 2;

/** Tiny inline-SVG sparkline. No axes, no library — a shape, not a chart. */
export function Sparkline({ points, tone = 'accent', label }: Props) {
  const n = points.length;
  const max = Math.max(1, ...points);
  const stroke = tone === 'accent' ? 'var(--color-accent)' : 'var(--color-muted)';

  const x = (i: number) => (n <= 1 ? PAD : PAD + (i * (W - 2 * PAD)) / (n - 1));
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = n ? `${line} L ${x(n - 1).toFixed(1)} ${H - PAD} L ${x(0).toFixed(1)} ${H - PAD} Z` : '';
  const lastX = x(n - 1);
  const lastY = y(points[n - 1] ?? 0);

  return (
    <svg className={`sparkline sparkline-${tone}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label ?? 'trend'}>
      {n > 1 ? <path className="sparkline-area" d={area} fill={stroke} opacity={0.12} /> : null}
      <path className="sparkline-line" d={line} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {n ? <circle cx={lastX} cy={lastY} r={2} fill={stroke} /> : null}
    </svg>
  );
}
