'use server';

import type { AppLanguage } from '@/i18n/types';
import { getRepositories } from '@/lib/repositories';
import { getMerchantInsights, getDailySeries, type MerchantInsights, type DailyPoint } from '@/domain/intelligence';
import { summarizeInsights, type AISummary } from '@/nail-ai/insights-summary';
import { demoMerchantId } from '@/mock/merchants';

/** Compute-on-read merchant demand intelligence (ADR-0006): every number derives from the live
 *  analytics_events log resolved against the merchant's OWN published styles. Scoped to this merchant
 *  — using all-merchant styles would let a filler shop's supply hide this shop's catalog gaps. */
export async function getMerchantInsightsAction(rangeDays = 7): Promise<MerchantInsights> {
  const repos = getRepositories();
  const [events, styleRecords] = await Promise.all([
    repos.analytics.listByMerchant(demoMerchantId),
    repos.merchantStyles.listByMerchant(demoMerchantId),
  ]);
  const styles = styleRecords.filter((s) => s.status === 'published');
  return getMerchantInsights(events, styles, demoMerchantId, { days: rangeDays });
}

/** Per-day funnel pulse for the report-card sparklines, over the last `days` (default 14). */
export async function getInsightsDailySeriesAction(days = 14): Promise<DailyPoint[]> {
  const repos = getRepositories();
  const events = await repos.analytics.listByMerchant(demoMerchantId);
  return getDailySeries(events, demoMerchantId, days);
}

/** Grounded AI narration of the same computed metrics. Recomputes server-side (does not trust a
 *  client-passed payload); falls back to a deterministic summary when the model is unavailable. */
export async function summarizeInsightsAction(
  rangeDays = 7,
  language: AppLanguage = 'zh-CN',
): Promise<AISummary> {
  const insights = await getMerchantInsightsAction(rangeDays);
  return summarizeInsights(insights, { language });
}
