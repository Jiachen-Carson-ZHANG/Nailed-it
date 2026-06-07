import { describe, it, expect } from 'vitest';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import { categoryOf, isServiceModule, tagsByCategory, tagLabelsOf } from './catalog-tags';

const facet = (label: string): StyleDiscoveryFacet => ({ kind: 'style', label });

describe('catalog-tags adapter', () => {
  it('resolves a real catalog label to its category', () => {
    expect(categoryOf('暗黑')).toBe('style');
  });

  it('returns null for a non-catalog label', () => {
    expect(categoryOf('not-a-real-label')).toBeNull();
  });

  it('flags container service modules', () => {
    expect(isServiceModule('颜色与效果服务')).toBe(true);
    expect(isServiceModule('暗黑')).toBe(false);
  });

  it('drops service modules and uncategorizable labels, de-dupes, keeps real tags', () => {
    const facets = [facet('颜色与效果服务'), facet('暗黑'), facet('暗黑'), facet('not-a-real-label')];
    expect(tagsByCategory(facets)).toEqual([{ label: '暗黑', category: 'style' }]);
    expect(tagLabelsOf(facets)).toEqual(['暗黑']);
  });
});
