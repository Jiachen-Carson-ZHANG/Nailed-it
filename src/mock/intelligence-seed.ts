// Demo-truth seed for the intelligence layer (ADR-0006, Phase C/G). A pure, deterministic generator
// bound to the REAL published style_ids + facets locked in the Phase-0 audit. Shared by both the
// regression test (intelligence-seed.test.ts) and the DB writer (scripts/seed-intelligence.ts).
//
// Three named personas match real conversation threads so the per-customer intel panel lands:
//   - Melissa Tan (cust-melissa, conv-melissa) — 裸色 / 法式风, budget ~SGD 80
//   - Amy Lim     (cust-amy,     conv-amy)     — 金属感 / 辣妹风, budget ~SGD 110
//   - Rachel Goh  (cust-rachel,  conv-rachel)  — 甜美 / 可爱,   budget ~SGD 70
// Plus anonymous volume personas that drive aggregate demand (暗黑 searches, the 8284 try-on surge)
// without needing a thread.
//
// Merchant narrative the numbers must produce:
//   - 金属感 demand rising (this week ≫ last week)
//   - low conversion: 8284 «鎏金奢华» — many try-ons, ~1 booking
//   - top converter:  8265 «极光法式碎钻» (裸色 + 法式风)
//   - catalog gap:    暗黑 — high search demand, exactly 1 published style (8281)

import type { Customer, NewAnalyticsEvent } from '@/domain/analytics';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import { demoMerchantId } from './merchants';
import { demoCustomerId, mockCustomers } from './customers';

const DAY = 86_400_000;

export const TOP_CONVERTER_ID = 'style-melissa-img-8265'; // 裸色 + 法式风
export const LOW_CONVERSION_ID = 'style-melissa-img-8284'; // 金属感
export const GAP_STYLE_ID = 'style-melissa-img-8281'; // the one published 暗黑 style

export const AMY_CUSTOMER_ID = 'cust-amy';
export const RACHEL_CUSTOMER_ID = 'cust-rachel';

const METALLIC_POOL = ['style-melissa-img-8282', 'style-melissa-img-8273', 'style-melissa-img-8274'];
const MELISSA_NUDE_FRENCH = [TOP_CONVERTER_ID, 'style-melissa-img-8249', 'style-melissa-img-8275', 'style-melissa-img-8266'];
const AMY_METALLIC = [LOW_CONVERSION_ID, 'style-melissa-img-8282']; // 金属感 / 辣妹风
const RACHEL_SWEET = ['style-melissa-img-8254', 'style-melissa-img-8277', 'style-melissa-img-8261']; // 甜美 / 可爱

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
  { id: 'style-melissa-img-8254', title: '奶咖拼图', discoveryFacets: facets('透色', '裸色', '多色', '绿色', '白色', '圆形', '短甲', '果冻感', '亮面', '中等', '甜美', '韩系', '可爱', '日常通勤') },
  { id: 'style-melissa-img-8277', title: '焦糖布丁布丁狗', discoveryFacets: facets('纯色', '透色', '黄色', '棕色', '圆形', '短甲', '果冻感', '亮面', '中等', '甜美', '可爱', '日常通勤') },
  { id: 'style-melissa-img-8261', title: '极光甜心', discoveryFacets: facets('透色', '裸色', '粉色', '白色', '银色', '杏仁形', '长甲', '果冻感', '亮面', '闪亮感', '复杂', '甜美', '韩系', '贵气', '可爱', '派对风') },
];

const namedPersonas: Customer[] = [
  { id: AMY_CUSTOMER_ID, merchantId: demoMerchantId, handle: 'amy', name: 'Amy Lim', avatarUrl: null, personaNote: '金属感 / 辣妹风 · budget ~SGD 110' },
  { id: RACHEL_CUSTOMER_ID, merchantId: demoMerchantId, handle: 'rachel', name: 'Rachel Goh', avatarUrl: null, personaNote: '甜美 / 可爱 · budget ~SGD 70' },
];

const volumePersonas: Customer[] = ['v1', 'v2', 'v3'].map((v, i) => ({
  id: `cust-${v}`,
  merchantId: demoMerchantId,
  handle: null,
  name: `访客${'ABC'[i]}`,
  avatarUrl: null,
  personaNote: 'Seeded anonymous demand.',
}));

/** All personas to seed: the live demo customer (Melissa) + 2 named threads + anonymous volume. */
export const seedCustomers: Customer[] = [...mockCustomers, ...namedPersonas, ...volumePersonas];
const VOL = volumePersonas.map((c) => c.id);

/**
 * ~2 weeks of behavioural history bound to the real published styles. `now` is injectable so the
 * regression test is deterministic; the DB seeder passes the wall clock so events are recent.
 */
export function generateSeedEvents(now: string | number | Date = Date.now()): NewAnalyticsEvent[] {
  const nowMs = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : new Date(now).getTime();
  const at = (daysAgo: number) => new Date(nowMs - daysAgo * DAY).toISOString();
  const vol = (i: number) => VOL[i % VOL.length];

  const events: NewAnalyticsEvent[] = [];
  let seq = 0;
  const push = (e: Omit<NewAnalyticsEvent, 'merchantId' | 'sessionId' | 'eventSource'>) => {
    seq += 1;
    events.push({ merchantId: demoMerchantId, sessionId: `seed-${seq}`, eventSource: 'seed', ...e });
  };
  const spread = (n: number, from: number, to: number, make: (i: number, daysAgo: number) => void) => {
    for (let i = 0; i < n; i += 1) make(i, from + ((to - from) * i) / Math.max(1, n - 1));
  };
  const interactions = (customerId: string, plan: Array<[NewAnalyticsEvent['eventType'], string]>, baseDay: number) =>
    plan.forEach(([eventType, styleId], i) => push({ eventType, customerId, styleId, createdAt: at(baseDay + i * 0.6) }));

  // ----- Aggregate demand (anonymous volume) -----
  // 暗黑 catalog gap: 21 searches across the fortnight; only 1 published 暗黑 style exists (8281).
  spread(21, 0.5, 13, (i, d) => push({ eventType: 'search_submitted', customerId: vol(i), query: '暗黑', createdAt: at(d) }));
  // 金属感 rising: previous week ≪ this week.
  spread(15, 8, 13, (i, d) => push({ eventType: 'search_submitted', customerId: vol(i), query: '金属感', createdAt: at(d) }));
  spread(20, 0.5, 6.5, (i, d) => push({ eventType: 'search_submitted', customerId: vol(i), query: '金属感', createdAt: at(d) }));
  spread(10, 8, 13, (i, d) => push({ eventType: 'style_card_click', customerId: vol(i), styleId: METALLIC_POOL[i % METALLIC_POOL.length], createdAt: at(d) }));
  // Low conversion: 8284 «鎏金奢华» — bulk try-ons (this week) + the single booking.
  spread(26, 0.3, 7.3, (i, d) => push({ eventType: 'try_on_completed', customerId: vol(i), styleId: LOW_CONVERSION_ID, createdAt: at(d) }));
  push({ eventType: 'booking_confirmed', customerId: vol(0), styleId: LOW_CONVERSION_ID, metadata: { price: 120 }, createdAt: at(2) });
  // Top converter: 8265 «极光法式碎钻» — 8 try-ons, 6 bookings.
  spread(8, 0.5, 10, (i, d) => push({ eventType: 'try_on_completed', customerId: vol(i), styleId: TOP_CONVERTER_ID, createdAt: at(d) }));
  spread(6, 0.6, 9, (i, d) => push({ eventType: 'booking_confirmed', customerId: vol(i), styleId: TOP_CONVERTER_ID, metadata: { price: 95 }, createdAt: at(d) }));

  // ----- Melissa: 裸色 / 法式风, budget ~80 -----
  interactions(demoCustomerId, [
    ['style_save', MELISSA_NUDE_FRENCH[0]],
    ['style_card_click', MELISSA_NUDE_FRENCH[1]],
    ['style_save', MELISSA_NUDE_FRENCH[2]],
    ['style_detail_view', MELISSA_NUDE_FRENCH[3]],
    ['try_on_completed', MELISSA_NUDE_FRENCH[0]],
    ['style_card_click', MELISSA_NUDE_FRENCH[2]],
    ['style_detail_view', MELISSA_NUDE_FRENCH[1]],
  ], 0.4);
  push({ eventType: 'booking_confirmed', customerId: demoCustomerId, styleId: TOP_CONVERTER_ID, metadata: { price: 80 }, createdAt: at(1) });

  // ----- Amy: 金属感 / 辣妹风, budget ~110 (try-ons add to 8284's load; books 8282, never 8284/8265) -----
  interactions(AMY_CUSTOMER_ID, [
    ['try_on_completed', AMY_METALLIC[0]],
    ['try_on_completed', AMY_METALLIC[1]],
    ['style_save', AMY_METALLIC[1]],
    ['style_card_click', AMY_METALLIC[0]],
    ['try_on_completed', AMY_METALLIC[0]],
    ['style_detail_view', AMY_METALLIC[1]],
    ['try_on_completed', AMY_METALLIC[0]],
  ], 0.5);
  push({ eventType: 'booking_confirmed', customerId: AMY_CUSTOMER_ID, styleId: AMY_METALLIC[1], metadata: { price: 110 }, createdAt: at(1.5) });

  // ----- Rachel: 甜美 / 可爱, budget ~70 -----
  interactions(RACHEL_CUSTOMER_ID, [
    ['style_save', RACHEL_SWEET[0]],
    ['style_card_click', RACHEL_SWEET[1]],
    ['style_detail_view', RACHEL_SWEET[2]],
    ['try_on_completed', RACHEL_SWEET[0]],
    ['style_card_click', RACHEL_SWEET[2]],
    ['style_save', RACHEL_SWEET[1]],
  ], 0.6);
  push({ eventType: 'booking_confirmed', customerId: RACHEL_CUSTOMER_ID, styleId: RACHEL_SWEET[0], metadata: { price: 70 }, createdAt: at(2.5) });

  return events;
}
