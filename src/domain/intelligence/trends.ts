// Trend & opportunity intelligence (ADR-0007 选品 agent; design spec 2026-06-27).
//
// The internal half already exists in getMerchantInsights (demandTrends = internal rising/falling,
// designPerformance = funnel + high-interest-low-conversion, catalogGaps = internal gaps). This module
// joins EXTERNAL trends onto that, matches each trend to the catalog by tag overlap, classifies it into
// an action bucket, scores, and ranks — the "pick top/bottom opportunities" pipeline. Pure / compute-
// on-read (ADR-0006): every number comes from the inputs, none invented.
import type { StyleDiscoveryFacet } from '@/domain/nail';
import type { MerchantInsights } from './types';

export type TrendSource = 'external' | 'internal';
/** amplify = invest ad · price_test = 团购券 · gap = propose 上架 (no catalog match) · prune = delist. */
export type OpportunityAction = 'amplify' | 'price_test' | 'gap';

/** An external/platform trend (e.g. from trending-styles): a label + its tag set. */
export type ExternalTrend = { label: string; tags: string[] };

export type TrendStyleInput = { id: string; title: string; discoveryFacets: StyleDiscoveryFacet[] };

export type TrendOpportunity = {
  trendLabel: string;
  tags: string[];
  sources: TrendSource[];
  /** Combined demand strength across sources, 0..1. */
  strength: number;
  matchedStyleIds: string[];
  /** Best tag-overlap of a matched style (gap uses a fixed low fit), 0..1. */
  fit: number;
  action: OpportunityAction;
  /** strength × fit × commercialValue, 0..1 — the ranking key. */
  score: number;
  reason: string;
};

export type TrendReport = {
  /** Actionable opportunities, highest score first (amplify / price_test / gap). */
  opportunities: TrendOpportunity[];
  /** Low-conversion styles on no rising trend — delist candidates. */
  prune: { styleId: string; title: string; reason: string }[];
};

const norm = (s: string) => s.trim().toLowerCase();
const round = (n: number) => Math.round(n * 100) / 100;

/** |trend ∩ style| / |trend| — fraction of the trend's tags the style covers. */
function overlap(trendTags: Set<string>, styleTags: Set<string>): number {
  if (trendTags.size === 0) return 0;
  let hit = 0;
  for (const tag of trendTags) if (styleTags.has(tag)) hit += 1;
  return hit / trendTags.size;
}

/**
 * Combine external trends with internal rising demand, match to the catalog, classify + score.
 * Defaults (design spec §5): matching = tag-overlap; equal-weight multiplicative score; commercial
 * value is a flat proxy (no margin data yet). v1 dedups by trend label.
 */
/** A tag's footprint across the whole platform (all merchants' published styles). */
export type PlatformHotTag = { tag: string; styleCount: number; merchantCount: number };

/**
 * 平台热门 (design spec §4): aggregate cross-merchant tag popularity over all published styles. v1 is
 * supply-based (how many styles + shops carry a tag) — the real signal the 5 merchants buy us, with no
 * mocking. (Demand-weighting via filler events is a later refinement.) 选品 compares this to the hero's
 * own catalog to spot what the platform is hot on that the hero under-stocks.
 */
export function getPlatformHotTags(
  styles: ReadonlyArray<{ merchantId: string; discoveryFacets: ReadonlyArray<{ label: string }> }>,
  topN = 12,
): PlatformHotTag[] {
  const stylesByTag = new Map<string, number>();
  const merchantsByTag = new Map<string, Set<string>>();
  for (const s of styles) {
    const seen = new Set<string>();
    for (const f of s.discoveryFacets) {
      const tag = f.label.trim();
      if (!tag || seen.has(tag)) continue; // count a tag once per style
      seen.add(tag);
      stylesByTag.set(tag, (stylesByTag.get(tag) ?? 0) + 1);
      const ms = merchantsByTag.get(tag) ?? new Set<string>();
      ms.add(s.merchantId);
      merchantsByTag.set(tag, ms);
    }
  }
  return [...stylesByTag.entries()]
    .map(([tag, styleCount]) => ({ tag, styleCount, merchantCount: merchantsByTag.get(tag)!.size }))
    .sort((a, b) => b.merchantCount - a.merchantCount || b.styleCount - a.styleCount || a.tag.localeCompare(b.tag))
    .slice(0, topN);
}

export function getTrendOpportunities(
  externalTrends: ExternalTrend[],
  insights: MerchantInsights,
  styles: TrendStyleInput[],
): TrendReport {
  const styleTags = new Map(
    styles.map((s) => [s.id, new Set(s.discoveryFacets.map((f) => norm(f.label)))]),
  );
  const lowConvIds = new Set(
    insights.designPerformance.highInterestLowConversion.map((s) => s.styleId),
  );

  // 1) Canonical trends: external + internal-rising (demandTrends direction 'up'), deduped by label.
  type Canon = { label: string; tags: Set<string>; sources: Set<TrendSource>; strength: number };
  const byKey = new Map<string, Canon>();
  const add = (label: string, tags: string[], source: TrendSource, strength: number) => {
    const key = norm(label);
    const existing = byKey.get(key);
    if (existing) {
      tags.forEach((t) => existing.tags.add(norm(t)));
      existing.sources.add(source);
      existing.strength = Math.min(1, existing.strength + strength);
    } else {
      byKey.set(key, { label, tags: new Set(tags.map(norm)), sources: new Set([source]), strength });
    }
  };
  externalTrends.forEach((t) => add(t.label, t.tags, 'external', 0.6));
  insights.demandTrends
    .filter((t) => t.direction === 'up')
    .forEach((t) => add(t.label, [t.label], 'internal', 0.4));

  // 2-4) match each trend → catalog, classify, score.
  const COMMERCIAL_VALUE = 0.5; // flat proxy until margin/price data is wired
  const GAP_FIT = 0.3; // a gap has no matched style; give it a modest fixed fit so it can still rank
  const opportunities: TrendOpportunity[] = [];
  for (const c of byKey.values()) {
    let bestFit = 0;
    const matched: string[] = [];
    for (const s of styles) {
      const f = overlap(c.tags, styleTags.get(s.id)!);
      if (f > 0) {
        matched.push(s.id);
        bestFit = Math.max(bestFit, f);
      }
    }

    let action: OpportunityAction;
    let reason: string;
    if (matched.length === 0) {
      action = 'gap';
      bestFit = GAP_FIT;
      reason = `需求上升但库内无匹配款式（${[...c.sources].join('+')}）→ 提醒上架`;
    } else if (matched.some((id) => lowConvIds.has(id))) {
      action = 'price_test';
      reason = '匹配款高意向低转化 → 团购券试价';
    } else {
      action = 'amplify';
      reason = '匹配款契合上升趋势 → 投广放大';
    }

    opportunities.push({
      trendLabel: c.label,
      tags: [...c.tags],
      sources: [...c.sources],
      strength: round(c.strength),
      matchedStyleIds: matched,
      fit: round(bestFit),
      action,
      score: round(c.strength * bestFit * COMMERCIAL_VALUE),
      reason,
    });
  }
  opportunities.sort((a, b) => b.score - a.score);

  // 5) Prune: low-conversion styles not riding any trend.
  const onTrend = new Set(opportunities.flatMap((o) => o.matchedStyleIds));
  const prune = insights.designPerformance.styles
    .filter((s) => s.tryOns >= 1 && (s.conversionRate ?? 0) < 0.1 && !onTrend.has(s.styleId))
    .map((s) => ({ styleId: s.styleId, title: s.title, reason: '长期低转化且不在任何上升趋势上 → 下架候选' }));

  return { opportunities, prune };
}
