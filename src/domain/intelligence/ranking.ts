import { isGenericTag, tagsByCategory } from '@/domain/catalog-tags';
import type { CustomerProfile, RankCandidate, RankedStyle } from './types';
import { DAY_MS, resolveNowMs, roundTo } from './shared';

export type RankContext = {
  now?: string | number | Date;
  /** styleId → popularity signal (e.g. event counts); see buildPopularityIndex. */
  popularityByStyle?: Map<string, number>;
};

// score = tag affinity (how well the style matches the profile) + a popularity nudge + a freshness
// nudge. Affinity dominates; popularity/freshness only break ties and lift cold-start cases.
const W_AFFINITY = 1.0;
const W_POPULARITY = 0.3;
const W_FRESHNESS = 0.2;

function freshnessScore(publishedAt: string | null | undefined, nowMs: number): number {
  if (!publishedAt) return 0;
  const age = (nowMs - new Date(publishedAt).getTime()) / DAY_MS;
  if (age <= 7) return 1;
  if (age <= 30) return 0.6;
  if (age <= 90) return 0.3;
  return 0.1;
}

/**
 * Rank candidate styles for a customer profile, reason-coded. One function, two call sites (the
 * customer feed and the merchant panel's "styles to send"). Pure: pass `now` + a popularity map for
 * deterministic output. Affinity is normalized against the profile's strongest tag so scores are
 * comparable across customers.
 */
export function rankStyles<T extends RankCandidate>(
  profile: CustomerProfile,
  candidates: T[],
  context: RankContext = {},
): RankedStyle<T>[] {
  const nowMs = resolveNowMs(context.now);
  const affinityByLabel = new Map(profile.tagScores.map((tag) => [tag.label, tag.score]));
  const maxAffinity = profile.tagScores[0]?.score ?? 0;
  const popularity = context.popularityByStyle ?? new Map<string, number>();
  const maxPopularity = Math.max(1, ...popularity.values());

  // Per-candidate tags + inverse document frequency across the candidate set: a tag on almost every
  // style (亮面, 日常通勤) is weighted down so a rare, distinctive match (法式风, 暗黑) dominates both
  // the score and the reason ordering.
  const candidateTags = candidates.map((style) => tagsByCategory(style.discoveryFacets));
  const docFreq = new Map<string, number>();
  for (const tags of candidateTags) for (const tag of tags) docFreq.set(tag.label, (docFreq.get(tag.label) ?? 0) + 1);
  const total = candidates.length;
  const idf = (label: string) => Math.log((total + 1) / ((docFreq.get(label) ?? 0) + 1)) + 1;

  const ranked: RankedStyle<T>[] = candidates.map((style, i) => {
    const matched: { label: string; contribution: number }[] = [];
    for (const tag of candidateTags[i]) {
      const score = affinityByLabel.get(tag.label) ?? 0;
      if (score > 0) matched.push({ label: tag.label, contribution: score * idf(tag.label) });
    }
    matched.sort((a, b) => b.contribution - a.contribution || a.label.localeCompare(b.label));

    const affinitySum = matched.reduce((sum, m) => sum + m.contribution, 0);
    const affinity = maxAffinity > 0 ? affinitySum / maxAffinity : 0;
    const popNorm = (popularity.get(style.id) ?? 0) / maxPopularity;
    const fresh = freshnessScore(style.publishedAt, nowMs);
    const score = roundTo(W_AFFINITY * affinity + W_POPULARITY * popNorm + W_FRESHNESS * fresh, 4);

    // Reason chip = the most distinctive matched tags, dropping generic filler; if all matches were
    // filler, fall back to the top matches so a chip still shows.
    const distinctive = matched.filter((m) => !isGenericTag(m.label));
    const topMatched = (distinctive.length > 0 ? distinctive : matched).slice(0, 3).map((m) => m.label);
    const reasonCodes = topMatched.map((label) => `tag:${label}`);
    if (popNorm >= 0.8) reasonCodes.push('popular');
    if (fresh >= 0.8) reasonCodes.push('fresh');
    const reasonText = topMatched.length
      ? `Matches your ${topMatched.join(' · ')}`
      : popNorm >= 0.5
        ? 'Popular right now'
        : 'New to explore';

    return { style, score, reasonCodes, reasonText };
  });

  ranked.sort((a, b) => b.score - a.score || a.style.id.localeCompare(b.style.id));
  return ranked;
}
