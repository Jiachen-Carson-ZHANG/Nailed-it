import { describe, it, expect } from 'vitest';
import type { AnalyticsEvent } from '@/domain/analytics';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import { getCustomerProfile } from './profile';
import { buildStyleTagIndex } from './shared';

const NOW = '2026-06-07T00:00:00.000Z';
const OLD = '2026-05-18T00:00:00.000Z'; // ~20 days → decay 0.2

const f = (label: string): StyleDiscoveryFacet => ({ kind: 'style', label });
const styleIndex = buildStyleTagIndex([
  { id: 's1', discoveryFacets: [f('裸色'), f('法式风')] },
  { id: 's2', discoveryFacets: [f('金属感')] },
]);

function ev(o: Partial<AnalyticsEvent> & { eventType: AnalyticsEvent['eventType'] }): AnalyticsEvent {
  return {
    id: `e-${Math.random().toString(36).slice(2)}`,
    merchantId: 'm1',
    customerId: 'c1',
    sessionId: null,
    eventSource: null,
    styleId: null,
    bookingId: null,
    technicianId: null,
    query: null,
    rankPosition: null,
    algorithmVersion: null,
    metadata: {},
    createdAt: NOW,
    ...o,
  };
}

describe('getCustomerProfile', () => {
  it('weights tags by event type and reports budget + event count', () => {
    const events = [
      ev({ eventType: 'booking_confirmed', styleId: 's1', metadata: { price: 80 } }),
      ev({ eventType: 'style_card_click', styleId: 's1' }),
      ev({ eventType: 'style_save', styleId: 's2' }),
      ev({ eventType: 'style_save', styleId: 's2', customerId: 'other' }), // ignored: different customer
    ];
    const profile = getCustomerProfile(events, styleIndex, 'c1', NOW);

    // booking (6) + click (1) on s1 → 裸色 & 法式风 each 7; save (3) on s2 → 金属感 3.
    expect(profile.tagScores.find((t) => t.label === '裸色')?.score).toBe(7);
    expect(profile.tagScores.find((t) => t.label === '法式风')?.score).toBe(7);
    expect(profile.tagScores.find((t) => t.label === '金属感')?.score).toBe(3);
    expect(profile.topTags.slice(0, 2).sort()).toEqual(['法式风', '裸色'].sort());
    expect(profile.averageBudget).toBe(80);
    expect(profile.eventCount).toBe(3);
    expect(profile.recentInterest).toContain('裸色');
  });

  it('decays old events so recent interest outranks stale interest', () => {
    const events = [
      ev({ eventType: 'booking_confirmed', styleId: 's2', createdAt: OLD, metadata: { price: 50 } }),
      ev({ eventType: 'style_save', styleId: 's1', createdAt: NOW }),
    ];
    const profile = getCustomerProfile(events, styleIndex, 'c1', NOW);

    // old booking: 6 × 0.2 = 1.2 for 金属感; recent save: 3 × 1.0 = 3 for 裸色/法式风.
    expect(profile.tagScores.find((t) => t.label === '金属感')?.score).toBeCloseTo(1.2);
    expect(profile.tagScores[0].score).toBe(3);
    expect(['裸色', '法式风']).toContain(profile.topTags[0]);
  });

  it('returns an empty profile (null budget) for a customer with no events', () => {
    const profile = getCustomerProfile([], styleIndex, 'ghost', NOW);
    expect(profile.tagScores).toEqual([]);
    expect(profile.averageBudget).toBeNull();
    expect(profile.eventCount).toBe(0);
  });
});
