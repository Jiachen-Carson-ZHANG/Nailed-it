import { describe, it, expect, vi } from 'vitest';
import type { MerchantInsights } from '@/domain/intelligence';
import { summarizeInsights } from './insights-summary';

const insights: MerchantInsights = {
  snapshot: { rangeDays: 7, impressions: 0, clicks: 5, detailViews: 0, saves: 3, tryOns: 34, bookings: 2, searches: 21, activeCustomers: 6 },
  demandTrends: [{ label: '金属感', category: 'texture', current: 42, previous: 29, delta: 13, direction: 'up' }],
  designPerformance: {
    styles: [
      { styleId: 's1', title: '鎏金奢华', impressions: 0, clicks: 0, saves: 0, tryOns: 34, bookings: 1, conversionRate: 0.03 },
      { styleId: 's2', title: '极光法式碎钻', impressions: 0, clicks: 0, saves: 0, tryOns: 8, bookings: 6, conversionRate: 0.75 },
    ],
    highInterestLowConversion: [
      { styleId: 's1', title: '鎏金奢华', impressions: 0, clicks: 0, saves: 0, tryOns: 34, bookings: 1, conversionRate: 0.03 },
    ],
  },
  catalogGaps: [{ label: '暗黑', category: 'style', searchCount: 21, matchingActiveStyles: 1 }],
};

const env = (o: Record<string, string | undefined>) => o as NodeJS.ProcessEnv;

describe('summarizeInsights', () => {
  it('falls back to a deterministic, grounded narration when no API key', async () => {
    const r = await summarizeInsights(insights, { env: env({}) });
    expect(r.source).toBe('fallback');
    expect(r.headline).toContain('21'); // restates the real search count
    expect(r.actions.join(' ')).toContain('暗黑'); // grounded action from the gap
  });

  it('uses the model output when available', async () => {
    const postChat = vi.fn(async () => ({
      choices: [{ message: { content: JSON.stringify({ headline: '本周金属感需求强劲', insights: ['一条洞察'], actions: ['一条行动'] }) } }],
    }));
    const r = await summarizeInsights(insights, { env: env({ OPENROUTER_API_KEY: 'k' }), postChat });
    expect(r.source).toBe('ai');
    expect(r.headline).toBe('本周金属感需求强劲');
    expect(postChat).toHaveBeenCalledOnce();
  });

  it('falls back when the model returns non-JSON junk', async () => {
    const postChat = vi.fn(async () => ({ choices: [{ message: { content: 'sorry I cannot' } }] }));
    const r = await summarizeInsights(insights, { env: env({ OPENROUTER_API_KEY: 'k' }), postChat });
    expect(r.source).toBe('fallback');
  });

  it('falls back fast when the model hangs past the timeout', async () => {
    const postChat = vi.fn(() => new Promise<unknown>(() => {})); // never resolves
    const r = await summarizeInsights(insights, {
      env: env({ OPENROUTER_API_KEY: 'k', INSIGHTS_TIMEOUT_MS: '50' }),
      postChat,
    });
    expect(r.source).toBe('fallback');
  });

  it('says insufficient data when there is no behavioural data', async () => {
    const empty: MerchantInsights = {
      snapshot: { rangeDays: 7, impressions: 0, clicks: 0, detailViews: 0, saves: 0, tryOns: 0, bookings: 0, searches: 0, activeCustomers: 0 },
      demandTrends: [],
      designPerformance: { styles: [], highInterestLowConversion: [] },
      catalogGaps: [],
    };
    const r = await summarizeInsights(empty, { env: env({}) });
    expect(r.headline).toMatch(/数据不足|Insufficient data/);
  });

  it('falls back in English when language is en', async () => {
    const r = await summarizeInsights(insights, { env: env({}), language: 'en' });
    expect(r.source).toBe('fallback');
    expect(r.headline).toContain('searches');
  });
});
