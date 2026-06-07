'use client';

import { useLanguage } from '@/i18n/context';
import type { StylePerformance } from '@/domain/intelligence';
import { pct, widthPct } from './format';

const copy = {
  'zh-CN': {
    tryBook: (t: number, b: number) => `试戴 ${t} · 预约 ${b}`,
    insufficient: '样本不足',
    winner: '转化最高',
    leak: '高意向 · 低转化',
  },
  en: {
    tryBook: (t: number, b: number) => `${t} try-ons · ${b} booked`,
    insufficient: 'Low sample',
    winner: 'Top converter',
    leak: 'High intent · low conversion',
  },
} as const;

type Props = {
  styles: StylePerformance[];
  /** Min try-ons before a conversion rate is trustworthy (else "样本不足"). */
  minTryOns?: number;
  limit?: number;
  winnerId?: string | null;
  leakIds?: string[];
};

/** Styles ranked by try-on volume; conversion shown as a sample-gated, colour-coded pill. */
export function StyleConversionBars({ styles, minTryOns = 3, limit = 6, winnerId, leakIds = [] }: Props) {
  const { language } = useLanguage();
  const labels = copy[language];
  const ranked = [...styles].filter((s) => s.tryOns > 0).sort((a, b) => b.tryOns - a.tryOns).slice(0, limit);
  const max = Math.max(1, ...ranked.map((s) => s.tryOns));
  const leak = new Set(leakIds);

  return (
    <ul className="conv-list">
      {ranked.map((style) => {
        const enough = style.tryOns >= minTryOns && style.conversionRate != null;
        const rate = style.conversionRate ?? 0;
        const tone = !enough ? 'conv-pill-na' : rate >= 0.5 ? 'conv-pill-good' : rate >= 0.2 ? 'conv-pill-mid' : 'conv-pill-low';
        const isWinner = style.styleId === winnerId;
        const isLeak = leak.has(style.styleId);
        return (
          <li className={`conv-row${isWinner ? ' conv-row-win' : isLeak ? ' conv-row-leak' : ''}`} key={style.styleId}>
            <div className="conv-head">
              <span className="conv-title">{style.title}</span>
              {isWinner ? <span className="conv-badge conv-badge-win">{labels.winner}</span> : null}
              {isLeak && !isWinner ? <span className="conv-badge conv-badge-leak">{labels.leak}</span> : null}
            </div>
            <span className="conv-track">
              <span className="conv-bar" style={{ width: widthPct(style.tryOns, max) }} />
            </span>
            <div className="conv-meta">
              <span className="conv-counts">{labels.tryBook(style.tryOns, style.bookings)}</span>
              <span className={`conv-pill ${tone}`}>{enough ? pct(rate) : labels.insufficient}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
