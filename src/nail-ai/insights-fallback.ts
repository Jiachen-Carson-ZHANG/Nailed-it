// Deterministic, grounded narration of the computed insights — the ALWAYS-available baseline.
// Pure: it reads only the pre-computed MerchantInsights fields, no model, no network, no env secrets.
// Lives in its own client-safe module so the merchant insights page can render a grounded card
// immediately (never gated on the slow/optional AI call) and upgrade to the AI narration if it arrives.

import type { AppLanguage } from '@/i18n/types';
import type { MerchantInsights } from '@/domain/intelligence';

export type AISummary = {
  headline: string;
  insights: string[];
  actions: string[];
  source: 'ai' | 'fallback';
};

export function fallbackSummary(
  insights: MerchantInsights,
  language: AppLanguage = 'zh-CN',
): AISummary {
  const s = insights.snapshot;
  const hasData = s.tryOns + s.bookings + s.searches > 0 || insights.demandTrends.length > 0;

  if (!hasData) {
    return language === 'en'
      ? { headline: 'Insufficient data to generate insights yet.', insights: [], actions: [], source: 'fallback' }
      : { headline: '数据不足，暂无足够行为数据生成洞察。', insights: [], actions: [], source: 'fallback' };
  }

  const points: string[] = [];
  const actions: string[] = [];

  const rising = insights.demandTrends.find((t) => t.direction === 'up');
  const low = insights.designPerformance.highInterestLowConversion[0];
  const gap = insights.catalogGaps[0];

  if (language === 'en') {
    if (rising) {
      points.push(`"${rising.label}" demand is rising (this week ${rising.current}, last week ${rising.previous}).`);
    }
    if (low) {
      points.push(`"${low.title}" had ${low.tryOns} try-ons but only ${low.bookings} bookings — conversion is low.`);
      actions.push(`Review pricing or presentation for "${low.title}" to improve conversion.`);
    }
    if (gap) {
      points.push(`Customers searched "${gap.label}" ${gap.searchCount} times but only ${gap.matchingActiveStyles} styles are live.`);
      actions.push(`Consider adding more "${gap.label}" styles to close the gap.`);
    }

    return {
      headline: `Last ${s.rangeDays} days: ${s.searches} searches, ${s.tryOns} try-ons, ${s.bookings} bookings.`,
      insights: points.slice(0, 3),
      actions: actions.slice(0, 2),
      source: 'fallback',
    };
  }

  if (rising) points.push(`"${rising.label}"需求上升（本周 ${rising.current}，上周 ${rising.previous}）。`);
  if (low) {
    points.push(`"${low.title}"试戴 ${low.tryOns} 次但仅 ${low.bookings} 次预订，转化偏低。`);
    actions.push(`复查"${low.title}"的定价或展示，提升转化。`);
  }
  if (gap) {
    points.push(`顾客搜索"${gap.label}" ${gap.searchCount} 次，但在售仅 ${gap.matchingActiveStyles} 款。`);
    actions.push(`考虑上架更多"${gap.label}"风格补足缺口。`);
  }

  return {
    headline: `近 ${s.rangeDays} 天：${s.searches} 次搜索、${s.tryOns} 次试戴、${s.bookings} 次预订。`,
    insights: points.slice(0, 3),
    actions: actions.slice(0, 2),
    source: 'fallback',
  };
}
