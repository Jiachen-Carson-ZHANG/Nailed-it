'use client';

import { useLanguage } from '@/i18n/context';
import type { DemandTrend } from '@/domain/intelligence';
import { widthPct } from './format';

const copy = {
  'zh-CN': { previous: (n: number) => `上期 ${n}`, unit: '触达次数' },
  en: { previous: (n: number) => `prev ${n}`, unit: 'touches' },
} as const;

/** Top demand movers as paired bars (current vs previous) with a direction-coloured delta. */
export function TrendBars({ rows, limit = 5 }: { rows: DemandTrend[]; limit?: number }) {
  const { language } = useLanguage();
  const labels = copy[language];
  const shown = rows.slice(0, limit);
  const max = Math.max(1, ...shown.map((r) => Math.max(r.current, r.previous)));

  return (
    <ul className="trend-list" aria-label={labels.unit}>
      {shown.map((row) => {
        const arrow = row.direction === 'up' ? '↑' : row.direction === 'down' ? '↓' : '→';
        return (
          <li className="trend-row" key={row.label}>
            <span className="trend-label">{row.label}</span>
            <span className="trend-bars">
              <span className="trend-bar trend-bar-current" style={{ width: widthPct(row.current, max) }} />
              <span className="trend-bar trend-bar-previous" style={{ width: widthPct(row.previous, max) }} />
            </span>
            <span className={`trend-delta trend-${row.direction}`}>
              {arrow} {row.current}
              <i className="trend-previous">{labels.previous(row.previous)}</i>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
