// Shared primitives for the intelligence read model: event weights, time decay, the style→tag
// index, and event→tag resolution. Pure and deterministic — a `now` is always passed in by callers
// (defaulting to Date.now only at the edge) so unit tests can fix time.

import type { AnalyticsEvent, AnalyticsEventType } from '@/domain/analytics';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import { tagsByCategory, type CategoryTag } from '@/domain/catalog-tags';

export const DAY_MS = 86_400_000;

/** Interest weight per event type for the customer affinity profile. recommended_style_sent is a
 *  merchant action (not customer interest), so it carries no affinity weight. */
export const EVENT_WEIGHTS: Record<AnalyticsEventType, number> = {
  style_impression: 0.5,
  style_card_click: 1,
  style_detail_view: 2,
  style_save: 3,
  try_on_completed: 4,
  booking_confirmed: 6,
  search_submitted: 2,
  search_no_result: 1,
  recommended_style_sent: 0,
};

/** Recency multiplier by event age in days (ADR-0006 / PRD): fresh interest counts more. */
export function decayForAge(ageDays: number): number {
  if (ageDays <= 3) return 1.0;
  if (ageDays <= 7) return 0.7;
  if (ageDays <= 14) return 0.4;
  return 0.2;
}

export function ageInDays(createdAt: string, nowMs: number): number {
  return Math.max(0, (nowMs - new Date(createdAt).getTime()) / DAY_MS);
}

export function resolveNowMs(now?: string | number | Date): number {
  if (now === undefined) return Date.now();
  if (now instanceof Date) return now.getTime();
  if (typeof now === 'number') return now;
  return new Date(now).getTime();
}

export function roundTo(n: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export type StyleTagIndex = Map<string, CategoryTag[]>;

/** styleId → its demand-meaningful catalog tags. Built once from the published styles and shared by
 *  the profile, trends, performance, gaps, and ranking so style→tag resolution stays consistent. */
export function buildStyleTagIndex(
  styles: { id: string; discoveryFacets: StyleDiscoveryFacet[] }[],
): StyleTagIndex {
  const index: StyleTagIndex = new Map();
  for (const style of styles) {
    index.set(style.id, tagsByCategory(style.discoveryFacets));
  }
  return index;
}

/** The catalog tags an event "touches": the resolved style's tags, plus any search/filter query
 *  parts that are themselves catalog labels (queries may be '|'-joined for multi-tag no-results). */
export function eventTags(event: AnalyticsEvent, index: StyleTagIndex): CategoryTag[] {
  const tags: CategoryTag[] = [];
  if (event.styleId) {
    const styleTags = index.get(event.styleId);
    if (styleTags) tags.push(...styleTags);
  }
  if (event.query) {
    for (const part of event.query.split('|')) {
      const trimmed = part.trim();
      if (trimmed) tags.push(...tagsByCategory([{ kind: 'style', label: trimmed }]));
    }
  }
  const seen = new Set<string>();
  return tags.filter((tag) => (seen.has(tag.label) ? false : (seen.add(tag.label), true)));
}

/** styleId → raw count of style-bearing events (a popularity signal for ranking). */
export function buildPopularityIndex(events: AnalyticsEvent[]): Map<string, number> {
  const pop = new Map<string, number>();
  for (const event of events) {
    if (!event.styleId) continue;
    pop.set(event.styleId, (pop.get(event.styleId) ?? 0) + 1);
  }
  return pop;
}
