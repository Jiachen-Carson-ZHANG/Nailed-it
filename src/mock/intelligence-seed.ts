// Demo-truth seed for the intelligence layer (ADR-0006, Phase C). A pure, deterministic generator
// bound to the REAL published style_ids + facets locked in the Phase-0 audit. Shared by both the
// regression test (intelligence-seed.test.ts — runs the read model and asserts the narrative) and
// the DB writer (scripts/seed-intelligence.ts). Built backward over ~2 weeks so the dashboard +
// Melissa's profile land on real numbers; the live demo appends on top.
//
// Narrative the numbers must produce:
//   - 金属感 demand rising (this week ≫ last week)
//   - low conversion: style-melissa-img-8284 «鎏金奢华» — many try-ons, ~1 booking
//   - top converter: style-melissa-img-8265 «极光法式碎钻» (裸色 + 法式风)
//   - catalog gap: 暗黑 — high search demand, exactly 1 published style (8281)
//   - Melissa: 裸色 (color) + 法式风 (style) preference, budget ~SGD 80

import type { Customer, NewAnalyticsEvent } from '@/domain/analytics';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import { demoMerchantId } from './merchants';
import { demoCustomerId, mockCustomers } from './customers';

const DAY = 86_400_000;

export const TOP_CONVERTER_ID = 'style-melissa-img-8265'; // 裸色 + 法式风
export const LOW_CONVERSION_ID = 'style-melissa-img-8284'; // 金属感
export const GAP_STYLE_ID = 'style-melissa-img-8281'; // the one published 暗黑 style
const METALLIC_POOL = ['style-melissa-img-8282', 'style-melissa-img-8273', 'style-melissa-img-8274'];
const MELISSA_NUDE_FRENCH = [TOP_CONVERTER_ID, 'style-melissa-img-8249', 'style-melissa-img-8275', 'style-melissa-img-8266'];

const facets = (...labels: string[]): StyleDiscoveryFacet[] =>
  labels.map((label) => ({ kind: 'style' as const, label }));

/** The published styles the narrative references, with their REAL facets (Phase-0 audit). Only used
 *  by the regression test for the supply side; the DB seed reads the live merchant_style rows. */
export const seedStyleFixtures: { id: string; title: string; discoveryFacets: StyleDiscoveryFacet[] }[] = [
  { id: 'style-melissa-img-8265', title: '极光法式碎钻', discoveryFacets: facets('透色', '裸色', '白色', '银色', '杏仁形', '中长甲', '果冻感', '亮面', '中等', '法式风', '清冷感', '新娘风', '日常通勤') },
  { id: 'style-melissa-img-8284', title: '鎏金奢华', discoveryFacets: facets('纯色', '透色', '金色', '裸色', '银色', '杏仁形', '长甲', '金属感', '果冻感', '闪亮感', '亮面', '复杂', '贵气', '派对风', '辣妹风') },
  { id: 'style-melissa-img-8282', title: '清冷冰蓝冷光甲', discoveryFacets: facets('纯色', '蓝色', '银色', '棺材形 / 梯形', '超长甲', '亮面', '金属感', '中等', '辣妹风', '贵气', '派对风') },
  { id: 'style-melissa-img-8273', title: '梦幻马卡龙', discoveryFacets: facets('纯色', '透色', '裸色', '粉色', '白色', '黄色', '多色', '银色', '杏仁形', '中长甲', '果冻感', '亮面', '金属感', '中等', '甜美', '韩系', 'Y2K', '可爱', '日常通勤') },
  { id: 'style-melissa-img-8274', title: '碎冰玫瑰猫眼', discoveryFacets: facets('纯色', '裸色', '银色', '白色', '杏仁形', '长甲', '亮面', '金属感', '闪亮感', '中等', '甜美', '清冷感', '日常通勤', '贵气') },
  { id: 'style-melissa-img-8281', title: '千禧迷幻克罗心', discoveryFacets: facets('纯色', '透色', '裸色', '红色', '棺材形 / 梯形', '长甲', '透感', '果冻感', '亮面', '简单', '辣妹风', 'Y2K', '可爱', '暗黑') },
  { id: 'style-melissa-img-8249', title: '薄荷青法式', discoveryFacets: facets('透色', '裸色', '绿色', '白色', '方圆形', '短甲', '果冻感', '亮面', '简单', '甜美', '可爱', '法式风', '日常通勤', '韩系') },
  { id: 'style-melissa-img-8275', title: '碎钻冰花法式', discoveryFacets: facets('透色', '裸色', '白色', '银色', '杏仁形', '中长甲', '果冻感', '亮面', '闪亮感', '中等', '韩系', '法式风', '清冷感', '新娘风', '日常通勤') },
  { id: 'style-melissa-img-8266', title: '温柔奶茶果冻', discoveryFacets: facets('纯色', '透色', '粉色', '裸色', '椭圆形', '中长甲', '亮面', '果冻感', '简单', '甜美', '极简', '清冷感', '日常通勤') },
];

const extraPersonas: Customer[] = [
  ['anya', 'Anya Lim'], ['bea', 'Bea Tan'], ['chloe', 'Chloe Ng'], ['dani', 'Dani Goh'], ['evelyn', 'Evelyn Wong'],
].map(([handle, name]) => ({
  id: `cust-${handle}`,
  merchantId: demoMerchantId,
  handle,
  name,
  avatarUrl: null,
  personaNote: 'Seeded persona for demand-intelligence history.',
}));

/** All personas to seed: the live demo customer (Melissa) + 5 background personas. */
export const seedCustomers: Customer[] = [...mockCustomers, ...extraPersonas];
const OTHER = extraPersonas.map((c) => c.id);

/**
 * ~2 weeks of behavioural history bound to the real published styles. `now` is injectable so the
 * regression test is deterministic; the DB seeder passes the wall clock so events are recent.
 */
export function generateSeedEvents(now: string | number | Date = Date.now()): NewAnalyticsEvent[] {
  const nowMs = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : new Date(now).getTime();
  const at = (daysAgo: number) => new Date(nowMs - daysAgo * DAY).toISOString();
  const other = (i: number) => OTHER[i % OTHER.length];

  const events: NewAnalyticsEvent[] = [];
  let seq = 0;
  const push = (e: Omit<NewAnalyticsEvent, 'merchantId' | 'sessionId' | 'eventSource'>) => {
    seq += 1;
    events.push({ merchantId: demoMerchantId, sessionId: `seed-${seq}`, eventSource: 'seed', ...e });
  };
  const spread = (n: number, from: number, to: number, make: (i: number, daysAgo: number) => void) => {
    for (let i = 0; i < n; i += 1) make(i, from + ((to - from) * i) / Math.max(1, n - 1));
  };

  // 暗黑 catalog gap: 21 searches across the fortnight; only 1 published 暗黑 style exists (8281).
  spread(21, 0.5, 13, (i, d) => push({ eventType: 'search_submitted', customerId: other(i), query: '暗黑', createdAt: at(d) }));

  // 金属感 rising: previous week (searches + clicks) ≪ this week (searches + the 8284 try-on surge).
  spread(15, 8, 13, (i, d) => push({ eventType: 'search_submitted', customerId: other(i), query: '金属感', createdAt: at(d) }));
  spread(20, 0.5, 6.5, (i, d) => push({ eventType: 'search_submitted', customerId: other(i + 1), query: '金属感', createdAt: at(d) }));
  spread(10, 8, 13, (i, d) => push({ eventType: 'style_card_click', customerId: other(i), styleId: METALLIC_POOL[i % METALLIC_POOL.length], createdAt: at(d) }));

  // Low conversion: 8284 «鎏金奢华» — 34 try-ons (mostly this week), 1 booking.
  spread(34, 0.3, 7.3, (i, d) => push({ eventType: 'try_on_completed', customerId: other(i), styleId: LOW_CONVERSION_ID, createdAt: at(d) }));
  push({ eventType: 'booking_confirmed', customerId: other(0), styleId: LOW_CONVERSION_ID, metadata: { price: 120 }, createdAt: at(2) });

  // Top converter: 8265 «极光法式碎钻» — 8 try-ons, 6 bookings (high conversion).
  spread(8, 0.5, 10, (i, d) => push({ eventType: 'try_on_completed', customerId: other(i), styleId: TOP_CONVERTER_ID, createdAt: at(d) }));
  spread(6, 0.6, 9, (i, d) => push({ eventType: 'booking_confirmed', customerId: other(i + 1), styleId: TOP_CONVERTER_ID, metadata: { price: 95 }, createdAt: at(d) }));

  // Melissa (the live demo customer): nude/french affinity + one booking @ SGD 80.
  const melissa: Array<[NewAnalyticsEvent['eventType'], string]> = [
    ['style_save', MELISSA_NUDE_FRENCH[0]],
    ['style_card_click', MELISSA_NUDE_FRENCH[1]],
    ['style_save', MELISSA_NUDE_FRENCH[2]],
    ['style_detail_view', MELISSA_NUDE_FRENCH[3]],
    ['try_on_completed', MELISSA_NUDE_FRENCH[0]],
    ['style_card_click', MELISSA_NUDE_FRENCH[2]],
    ['style_detail_view', MELISSA_NUDE_FRENCH[1]],
  ];
  melissa.forEach(([eventType, styleId], i) =>
    push({ eventType, customerId: demoCustomerId, styleId, createdAt: at(0.4 + i * 0.6) }),
  );
  push({ eventType: 'booking_confirmed', customerId: demoCustomerId, styleId: TOP_CONVERTER_ID, metadata: { price: 80 }, createdAt: at(1) });

  return events;
}
