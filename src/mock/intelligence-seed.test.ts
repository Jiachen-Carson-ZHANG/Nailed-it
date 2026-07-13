// Phase C regression / eval (ADR-0006 eval rules): the seeded demo dataset, run through the read
// model, MUST produce the locked demo narrative. Deterministic (fixed `now`, no DB).

import { describe, it, expect, beforeAll } from 'vitest';
import { createMemoryAnalyticsRepository } from '@/lib/repositories/memory/analytics-repository';
import {
  buildStyleTagIndex,
  getCustomerProfile,
  getMerchantInsights,
  type MerchantInsights,
  type CustomerProfile,
} from '@/domain/intelligence';
import { demoMerchantId } from '@/mock/merchants';
import { demoCustomerId } from '@/mock/customers';
import {
  generateSeedEvents,
  seedStyleFixtures,
  TOP_CONVERTER_ID,
  LOW_CONVERSION_ID,
  AMY_CUSTOMER_ID,
  RACHEL_CUSTOMER_ID,
} from './intelligence-seed';

const NOW = '2026-06-07T12:00:00.000Z';

let insights: MerchantInsights;
let melissa: CustomerProfile;
let amy: CustomerProfile;
let rachel: CustomerProfile;

beforeAll(async () => {
  const repo = createMemoryAnalyticsRepository();
  for (const event of generateSeedEvents(NOW)) await repo.record(event);
  const events = await repo.listByMerchant(demoMerchantId);
  const index = buildStyleTagIndex(seedStyleFixtures);
  insights = getMerchantInsights(events, seedStyleFixtures, demoMerchantId, { days: 7 }, NOW);
  melissa = getCustomerProfile(events, index, demoCustomerId, NOW);
  amy = getCustomerProfile(events, index, AMY_CUSTOMER_ID, NOW);
  rachel = getCustomerProfile(events, index, RACHEL_CUSTOMER_ID, NOW);
});

describe('intelligence demo seed → read model narrative', () => {
  it('produces a monotonic discovery funnel (曝光 ≥ 点击 ≥ 详情 ≥ 试戴 ≥ 预约)', () => {
    const s = insights.snapshot;
    expect(s.impressions).toBeGreaterThanOrEqual(s.clicks);
    expect(s.clicks).toBeGreaterThanOrEqual(s.detailViews);
    expect(s.detailViews).toBeGreaterThanOrEqual(s.tryOns);
    expect(s.tryOns).toBeGreaterThanOrEqual(s.bookings);
    // The narrative volumes survive: still a real try-on surge and a few bookings.
    expect(s.tryOns).toBeGreaterThanOrEqual(20);
    expect(s.bookings).toBeGreaterThanOrEqual(5);
  });

  it('keeps every flagged style funnel-monotonic per style (曝光 ≥ 点击 ≥ 试戴 ≥ 预约)', () => {
    for (const st of insights.designPerformance.styles) {
      expect(st.impressions).toBeGreaterThanOrEqual(st.clicks);
      expect(st.clicks).toBeGreaterThanOrEqual(st.tryOns);
      expect(st.tryOns).toBeGreaterThanOrEqual(st.bookings);
    }
  });

  it('surfaces 暗黑 as the honest catalog gap (high demand, ≤1 published style)', () => {
    const gap = insights.catalogGaps.find((g) => g.label === '暗黑');
    expect(gap).toBeDefined();
    expect(gap!.matchingActiveStyles).toBeLessThanOrEqual(1);
    expect(gap!.searchCount).toBeGreaterThanOrEqual(10);
    // 金属感 is in demand but well-supplied → must NOT be a gap.
    expect(insights.catalogGaps.some((g) => g.label === '金属感')).toBe(false);
  });

  it('shows 金属感 demand rising this period vs last', () => {
    const trend = insights.demandTrends.find((t) => t.label === '金属感');
    expect(trend?.direction).toBe('up');
    expect(trend!.current).toBeGreaterThan(trend!.previous);
  });

  it('flags 鎏金奢华 (8284) as high-interest / low-conversion', () => {
    const flagged = insights.designPerformance.highInterestLowConversion;
    expect(flagged.map((s) => s.styleId)).toContain(LOW_CONVERSION_ID);
    const lc = flagged.find((s) => s.styleId === LOW_CONVERSION_ID)!;
    expect(lc.tryOns).toBeGreaterThanOrEqual(8);
    expect(lc.bookings).toBeLessThanOrEqual(1);
  });

  it('ranks 极光法式碎钻 (8265) as the top converter', () => {
    // Min try-on sample so a 1-try / 1-book style does not show a misleading 100% (the dashboard's
    // "转化最高" applies the same guard).
    const withConversion = insights.designPerformance.styles.filter((s) => s.tryOns >= 3);
    const top = withConversion.reduce((best, s) => (s.conversionRate! > best.conversionRate! ? s : best));
    expect(top.styleId).toBe(TOP_CONVERTER_ID);
    const lc = insights.designPerformance.styles.find((s) => s.styleId === LOW_CONVERSION_ID)!;
    expect(top.conversionRate!).toBeGreaterThan(lc.conversionRate!);
  });

  it("captures Melissa's nude/french preference and ~¥80 budget", () => {
    expect(melissa.topByCategory.color?.[0]).toBe('裸色');
    expect(melissa.topByCategory.style?.slice(0, 2)).toContain('法式风');
    expect(melissa.averageBudget).toBe(80);
  });

  it('gives Amy a distinct 金属感 / 辣妹风 profile (¥110)', () => {
    expect(amy.topTags).toEqual(expect.arrayContaining(['金属感', '辣妹风']));
    expect(amy.topTags).not.toContain('甜美');
    expect(amy.averageBudget).toBe(110);
  });

  it('gives Rachel a distinct 甜美 / 可爱 profile (¥70)', () => {
    expect(rachel.topTags).toEqual(expect.arrayContaining(['甜美', '可爱']));
    expect(rachel.topTags).not.toContain('金属感');
    expect(rachel.averageBudget).toBe(70);
  });
});
