import type { AnalyticsEvent } from '@/domain/analytics';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import type {
  CatalogGap,
  DemandTrend,
  InsightsSnapshot,
  MerchantInsights,
  StylePerformance,
  TrendDirection,
} from './types';
import { DAY_MS, buildStyleTagIndex, eventTags, resolveNowMs } from './shared';

export type InsightsRange = { days: number };

/** A style is "high interest, low conversion" when many try-ons produced ~no booking. */
const HIGH_INTEREST_TRYONS = 8;
const LOW_CONVERSION_BOOKINGS = 1;

/** A tag is a catalog gap when demand clears this and ≤1 published style matches (ADR-0006: use
 *  ≤1, not the PRD's ≤2, for a crisp "you have only one / none"). */
const GAP_SEARCH_THRESHOLD = 10;
const GAP_MAX_MATCHING_STYLES = 1;

type StyleInput = { id: string; title: string; discoveryFacets: StyleDiscoveryFacet[] };

function direction(delta: number): TrendDirection {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

/**
 * Compute-on-read merchant demand intelligence over the event log + the published styles. Snapshot
 * + demand trends use the windowed events (this period vs the previous equal period); design
 * performance + catalog gaps use the full history so try-on/booking/search counts are meaningful.
 * `now` is injectable for deterministic tests.
 */
export function getMerchantInsights(
  events: AnalyticsEvent[],
  styles: StyleInput[],
  merchantId: string,
  range: InsightsRange = { days: 7 },
  now?: string | number | Date,
): MerchantInsights {
  const nowMs = resolveNowMs(now);
  const rangeMs = range.days * DAY_MS;
  const curStart = nowMs - rangeMs;
  const prevStart = nowMs - 2 * rangeMs;
  const styleIndex = buildStyleTagIndex(styles);

  const mine = events.filter((event) => event.merchantId === merchantId);
  const at = (event: AnalyticsEvent) => new Date(event.createdAt).getTime();
  const current = mine.filter((event) => at(event) >= curStart && at(event) <= nowMs);
  const previous = mine.filter((event) => at(event) >= prevStart && at(event) < curStart);

  return {
    snapshot: buildSnapshot(current, range.days),
    demandTrends: buildDemandTrends(current, previous, styleIndex),
    designPerformance: buildDesignPerformance(mine, styles),
    catalogGaps: buildCatalogGaps(mine, styleIndex),
  };
}

function buildSnapshot(current: AnalyticsEvent[], rangeDays: number): InsightsSnapshot {
  const count = (type: AnalyticsEvent['eventType']) =>
    current.filter((event) => event.eventType === type).length;
  const customers = new Set(current.map((event) => event.customerId).filter(Boolean));
  return {
    rangeDays,
    impressions: count('style_impression'),
    clicks: count('style_card_click'),
    detailViews: count('style_detail_view'),
    saves: count('style_save'),
    tryOns: count('try_on_completed'),
    bookings: count('booking_confirmed'),
    searches: count('search_submitted'),
    activeCustomers: customers.size,
  };
}

function buildDemandTrends(
  current: AnalyticsEvent[],
  previous: AnalyticsEvent[],
  styleIndex: ReturnType<typeof buildStyleTagIndex>,
): DemandTrend[] {
  const tally = new Map<string, { category: string; current: number; previous: number }>();
  const add = (events: AnalyticsEvent[], key: 'current' | 'previous') => {
    for (const event of events) {
      for (const tag of eventTags(event, styleIndex)) {
        const row = tally.get(tag.label) ?? { category: tag.category, current: 0, previous: 0 };
        row[key] += 1;
        tally.set(tag.label, row);
      }
    }
  };
  add(current, 'current');
  add(previous, 'previous');

  return [...tally.entries()]
    .map(([label, row]) => ({
      label,
      category: row.category,
      current: row.current,
      previous: row.previous,
      delta: row.current - row.previous,
      direction: direction(row.current - row.previous),
    }))
    .sort((a, b) => b.current - a.current || b.delta - a.delta || a.label.localeCompare(b.label));
}

function buildDesignPerformance(
  events: AnalyticsEvent[],
  styles: StyleInput[],
): MerchantInsights['designPerformance'] {
  const titleById = new Map(styles.map((style) => [style.id, style.title]));
  const byStyle = new Map<string, StylePerformance>();
  const blank = (styleId: string): StylePerformance => ({
    styleId,
    title: titleById.get(styleId) ?? styleId,
    impressions: 0,
    clicks: 0,
    saves: 0,
    tryOns: 0,
    bookings: 0,
    conversionRate: null,
  });

  for (const event of events) {
    if (!event.styleId) continue;
    const row = byStyle.get(event.styleId) ?? blank(event.styleId);
    switch (event.eventType) {
      case 'style_impression': row.impressions += 1; break;
      case 'style_card_click': row.clicks += 1; break;
      case 'style_save': row.saves += 1; break;
      case 'try_on_completed': row.tryOns += 1; break;
      case 'booking_confirmed': row.bookings += 1; break;
      default: break;
    }
    byStyle.set(event.styleId, row);
  }

  const stylesPerf = [...byStyle.values()].map((row) => ({
    ...row,
    conversionRate: row.tryOns > 0 ? Math.round((row.bookings / row.tryOns) * 100) / 100 : null,
  }));

  // Most-engaged first (try-ons then saves then clicks).
  stylesPerf.sort(
    (a, b) => b.tryOns - a.tryOns || b.saves - a.saves || b.clicks - a.clicks || a.styleId.localeCompare(b.styleId),
  );

  const highInterestLowConversion = stylesPerf
    .filter((row) => row.tryOns >= HIGH_INTEREST_TRYONS && row.bookings <= LOW_CONVERSION_BOOKINGS)
    .sort((a, b) => b.tryOns - a.tryOns);

  return { styles: stylesPerf, highInterestLowConversion };
}

function buildCatalogGaps(
  events: AnalyticsEvent[],
  styleIndex: ReturnType<typeof buildStyleTagIndex>,
): CatalogGap[] {
  // How many published styles carry each tag (supply side).
  const supply = new Map<string, number>();
  for (const tags of styleIndex.values()) {
    for (const tag of tags) supply.set(tag.label, (supply.get(tag.label) ?? 0) + 1);
  }

  // Search demand per tag (demand side).
  const demand = new Map<string, { category: string; count: number }>();
  for (const event of events) {
    if (event.eventType !== 'search_submitted' && event.eventType !== 'search_no_result') continue;
    for (const tag of eventTags(event, styleIndex)) {
      const row = demand.get(tag.label) ?? { category: tag.category, count: 0 };
      row.count += 1;
      demand.set(tag.label, row);
    }
  }

  return [...demand.entries()]
    .map(([label, row]) => ({
      label,
      category: row.category,
      searchCount: row.count,
      matchingActiveStyles: supply.get(label) ?? 0,
    }))
    .filter((gap) => gap.searchCount >= GAP_SEARCH_THRESHOLD && gap.matchingActiveStyles <= GAP_MAX_MATCHING_STYLES)
    .sort((a, b) => b.searchCount - a.searchCount || a.label.localeCompare(b.label));
}
