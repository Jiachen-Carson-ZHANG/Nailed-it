'use client';

import { useLanguage } from '@/i18n/context';
import type { CatalogGap } from '@/domain/intelligence';
import { widthPct } from './format';

const copy = {
  'zh-CN': {
    wants: (label: string) => `顾客想要「${label}」`,
    demand: '需求',
    supply: '在售',
    searches: (n: number) => `${n} 次搜索`,
    styles: (n: number) => `${n} 款`,
    hint: '需求远超供给，建议上架更多相关款式。',
  },
  en: {
    wants: (label: string) => `Customers want “${label}”`,
    demand: 'Demand',
    supply: 'In stock',
    searches: (n: number) => `${n} searches`,
    styles: (n: number) => `${n} styles`,
    hint: 'Demand far exceeds supply — add more matching styles.',
  },
} as const;

/** One catalog gap as demand-vs-supply bars (supply scaled against demand). */
export function GapBar({ gap }: { gap: CatalogGap }) {
  const { language } = useLanguage();
  const labels = copy[language];

  return (
    <div className="gap-card">
      <p className="gap-title">{labels.wants(gap.label)}</p>
      <div className="gap-row">
        <span className="gap-row-label">{labels.demand}</span>
        <span className="gap-track">
          <span className="gap-fill gap-demand" style={{ width: '100%' }} />
        </span>
        <span className="gap-row-value">{labels.searches(gap.searchCount)}</span>
      </div>
      <div className="gap-row">
        <span className="gap-row-label">{labels.supply}</span>
        <span className="gap-track">
          <span className="gap-fill gap-supply" style={{ width: widthPct(gap.matchingActiveStyles, gap.searchCount) }} />
        </span>
        <span className="gap-row-value">{labels.styles(gap.matchingActiveStyles)}</span>
      </div>
      <p className="gap-hint">{labels.hint}</p>
    </div>
  );
}
