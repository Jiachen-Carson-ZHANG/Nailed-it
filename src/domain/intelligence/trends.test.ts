import { describe, expect, it } from 'vitest';
import { getTrendOpportunities, getPlatformHotTags, type ExternalTrend, type TrendStyleInput } from './trends';
import type { MerchantInsights, StylePerformance } from './types';

// Minimal insights fixture — only the fields getTrendOpportunities reads.
function perf(over: Partial<StylePerformance> & { styleId: string; title: string }): StylePerformance {
  return {
    impressions: 0, clicks: 0, saves: 0, tryOns: 0, bookings: 0, conversionRate: null, ...over,
  };
}

const styles: TrendStyleInput[] = [
  { id: 's-metal', title: '金属感冰花', discoveryFacets: [{ kind: 'mood', label: '金属感' }] },
  { id: 's-nude', title: '裸色法式', discoveryFacets: [{ kind: 'style', label: '法式' }] },
];

const insights = {
  snapshot: {} as MerchantInsights['snapshot'],
  demandTrends: [
    { label: '法式', category: 'style', current: 10, previous: 4, delta: 6, direction: 'up' as const },
  ],
  designPerformance: {
    styles: [
      perf({ styleId: 's-metal', title: '金属感冰花', tryOns: 20, bookings: 1, conversionRate: 0.05 }),
      perf({ styleId: 's-nude', title: '裸色法式', tryOns: 10, bookings: 6, conversionRate: 0.6 }),
      perf({ styleId: 's-dead', title: '弃款', tryOns: 5, bookings: 0, conversionRate: 0 }),
    ],
    highInterestLowConversion: [
      perf({ styleId: 's-metal', title: '金属感冰花', tryOns: 20, bookings: 1, conversionRate: 0.05 }),
    ],
  },
  catalogGaps: [],
} as MerchantInsights;

describe('getTrendOpportunities', () => {
  const externalTrends: ExternalTrend[] = [
    { label: '金属感', tags: ['金属感'] }, // matches s-metal (which is high-interest-low-conversion)
    { label: '暗黑', tags: ['暗黑'] },     // no catalog match → gap
  ];
  const report = getTrendOpportunities(externalTrends, insights, styles);

  it('classifies a matched low-conversion trend as price_test', () => {
    const metal = report.opportunities.find((o) => o.trendLabel === '金属感');
    expect(metal?.action).toBe('price_test');
    expect(metal?.matchedStyleIds).toContain('s-metal');
  });

  it('classifies an external trend with no catalog match as a gap', () => {
    const dark = report.opportunities.find((o) => o.trendLabel === '暗黑');
    expect(dark?.action).toBe('gap');
    expect(dark?.matchedStyleIds).toHaveLength(0);
  });

  it('classifies an internal-rising trend matched to a healthy style as amplify', () => {
    const french = report.opportunities.find((o) => o.trendLabel === '法式');
    expect(french?.action).toBe('amplify');
    expect(french?.sources).toContain('internal');
  });

  it('ranks opportunities by score (descending)', () => {
    const scores = report.opportunities.map((o) => o.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('marks a low-conversion off-trend style for prune', () => {
    expect(report.prune.map((p) => p.styleId)).toContain('s-dead');
    expect(report.prune.map((p) => p.styleId)).not.toContain('s-metal'); // on a trend → not pruned
  });
});

describe('getPlatformHotTags', () => {
  const styles = [
    { merchantId: 'm1', discoveryFacets: [{ label: '镜面' }, { label: '金属感' }] },
    { merchantId: 'm2', discoveryFacets: [{ label: '镜面' }, { label: '法式' }] },
    { merchantId: 'm3', discoveryFacets: [{ label: '镜面' }] },
    { merchantId: 'm1', discoveryFacets: [{ label: '法式' }] },
  ];

  it('ranks tags by cross-merchant reach then style count', () => {
    const hot = getPlatformHotTags(styles);
    expect(hot[0].tag).toBe('镜面'); // 3 merchants, 3 styles
    expect(hot[0].merchantCount).toBe(3);
    expect(hot[0].styleCount).toBe(3);
    const french = hot.find((h) => h.tag === '法式');
    expect(french?.merchantCount).toBe(2);
  });

  it('counts a tag once per style', () => {
    const hot = getPlatformHotTags([{ merchantId: 'm1', discoveryFacets: [{ label: '镜面' }, { label: '镜面' }] }]);
    expect(hot.find((h) => h.tag === '镜面')?.styleCount).toBe(1);
  });
});
