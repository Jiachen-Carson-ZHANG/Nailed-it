import type { AnalyticsEvent } from '@/domain/analytics';
import type { CustomerProfile, TagScore } from './types';
import {
  EVENT_WEIGHTS,
  ageInDays,
  decayForAge,
  eventTags,
  resolveNowMs,
  roundTo,
  type StyleTagIndex,
} from './shared';

const RECENT_WINDOW_DAYS = 7;

/**
 * Weighted, time-decayed tag affinity for one customer, plus average budget and recent interest.
 * Every tag score traces to events: weight (by event type) × decay (by age), summed per tag.
 * `now` is injectable for deterministic tests.
 */
export function getCustomerProfile(
  events: AnalyticsEvent[],
  styleIndex: StyleTagIndex,
  customerId: string,
  now?: string | number | Date,
): CustomerProfile {
  const nowMs = resolveNowMs(now);
  const mine = events.filter((event) => event.customerId === customerId);

  const scoreByLabel = new Map<string, { category: string; score: number }>();
  const recent = new Set<string>();
  const budgets: number[] = [];

  for (const event of mine) {
    if (event.eventType === 'booking_confirmed') {
      const price = event.metadata.price;
      if (typeof price === 'number' && price > 0) budgets.push(price);
    }
    const weight = EVENT_WEIGHTS[event.eventType] ?? 0;
    if (weight === 0) continue;

    const age = ageInDays(event.createdAt, nowMs);
    const decay = decayForAge(age);
    for (const tag of eventTags(event, styleIndex)) {
      const prev = scoreByLabel.get(tag.label);
      scoreByLabel.set(tag.label, { category: tag.category, score: (prev?.score ?? 0) + weight * decay });
      if (age <= RECENT_WINDOW_DAYS) recent.add(tag.label);
    }
  }

  const tagScores: TagScore[] = [...scoreByLabel.entries()]
    .map(([label, value]) => ({ label, category: value.category, score: roundTo(value.score) }))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  const topByCategory: Record<string, string[]> = {};
  for (const tag of tagScores) {
    (topByCategory[tag.category] ??= []).push(tag.label);
  }

  return {
    customerId,
    eventCount: mine.length,
    tagScores,
    topTags: tagScores.map((tag) => tag.label),
    topByCategory,
    averageBudget: budgets.length
      ? roundTo(budgets.reduce((sum, value) => sum + value, 0) / budgets.length)
      : null,
    recentInterest: tagScores.filter((tag) => recent.has(tag.label)).map((tag) => tag.label),
  };
}
