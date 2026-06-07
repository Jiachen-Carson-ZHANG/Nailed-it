import { describe, it, expect } from 'vitest';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import type { CustomerProfile, RankCandidate } from './types';
import { rankStyles } from './ranking';

const NOW = '2026-06-07T00:00:00.000Z';
const f = (label: string): StyleDiscoveryFacet => ({ kind: 'style', label });

const profile: CustomerProfile = {
  customerId: 'c1',
  eventCount: 5,
  tagScores: [
    { label: '裸色', category: 'color', score: 7 },
    { label: '法式风', category: 'style', score: 5 },
    { label: '金属感', category: 'color_effect', score: 1 },
  ],
  topTags: ['裸色', '法式风', '金属感'],
  topByCategory: { color: ['裸色'], style: ['法式风'], color_effect: ['金属感'] },
  averageBudget: 80,
  recentInterest: ['裸色'],
};

const candidates: RankCandidate[] = [
  { id: 'cand-nude', discoveryFacets: [f('裸色'), f('法式风')] },
  { id: 'cand-metal', discoveryFacets: [f('金属感')] },
  { id: 'cand-popular', discoveryFacets: [f('暗黑')] }, // no profile affinity, but popular
  { id: 'cand-fresh', discoveryFacets: [], publishedAt: NOW }, // no affinity/popularity, just fresh
];

describe('rankStyles', () => {
  const ranked = rankStyles(profile, candidates, {
    now: NOW,
    popularityByStyle: new Map([['cand-popular', 10]]),
  });

  it('ranks the best tag match first with reason codes + text', () => {
    expect(ranked[0].style.id).toBe('cand-nude');
    expect(ranked[0].reasonCodes).toEqual(expect.arrayContaining(['tag:裸色', 'tag:法式风']));
    expect(ranked[0].reasonText).toBe('Matches your 裸色 · 法式风');
  });

  it('lets popularity lift a zero-affinity style above a weak match', () => {
    const order = ranked.map((r) => r.style.id);
    expect(order.indexOf('cand-popular')).toBeLessThan(order.indexOf('cand-metal'));
    const popular = ranked.find((r) => r.style.id === 'cand-popular')!;
    expect(popular.reasonCodes).toContain('popular');
    expect(popular.reasonText).toBe('Popular right now');
  });

  it('codes freshness for a brand-new style with no other signal', () => {
    const fresh = ranked.find((r) => r.style.id === 'cand-fresh')!;
    expect(fresh.reasonCodes).toContain('fresh');
    expect(fresh.reasonText).toBe('New to explore');
  });

  it('surfaces distinctive (rare) tags in the reason and suppresses generic filler', () => {
    const fillerProfile: CustomerProfile = {
      customerId: 'c1',
      eventCount: 8,
      tagScores: [
        { label: '亮面', category: 'texture', score: 30 }, // filler, highest raw score
        { label: '裸色', category: 'color', score: 22 },
        { label: '法式风', category: 'style', score: 18 }, // rarest in the set
      ],
      topTags: ['亮面', '裸色', '法式风'],
      topByCategory: {},
      averageBudget: null,
      recentInterest: [],
    };
    // 亮面 on all 4, 裸色 on 3, 法式风 on 1 → IDF lifts 法式风 above 裸色 despite a lower raw score.
    const cands: RankCandidate[] = [
      { id: 'a', discoveryFacets: [f('亮面'), f('裸色'), f('法式风')] },
      { id: 'b', discoveryFacets: [f('亮面'), f('裸色')] },
      { id: 'c', discoveryFacets: [f('亮面'), f('裸色')] },
      { id: 'd', discoveryFacets: [f('亮面')] },
    ];
    const a = rankStyles(fillerProfile, cands).find((r) => r.style.id === 'a')!;
    expect(a.reasonCodes).not.toContain('tag:亮面'); // generic filler suppressed
    expect(a.reasonCodes[0]).toBe('tag:法式风'); // rare/distinctive leads
    expect(a.reasonText).toBe('Matches your 法式风 · 裸色');
  });
});
