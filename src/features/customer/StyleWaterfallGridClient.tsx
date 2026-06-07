'use client';

import { useMemo, useState } from 'react';
import type { NailStyleCard, StyleDiscoveryFacetKind } from '@/domain/nail';
import { EmptyState } from '@/components/ui/EmptyState';
import { HASHTAG_KIND_ORDER, StyleCard } from './StyleCard';
import { useSavedStyles } from './SavedStylesContext';

type StyleWaterfallGridClientProps = {
  styles: NailStyleCard[];
};

const tabs = ['Trending', 'Saved'] as const;
type TabLabel = typeof tabs[number];

// Distinct facet labels across the loaded feed, ordered the same way the card hashtags are, so the
// filter chips only ever offer tags that actually exist in the current styles (no dead filters).
function collectFacetLabels(styles: NailStyleCard[]): string[] {
  const labelKind = new Map<string, StyleDiscoveryFacetKind>();
  for (const style of styles) {
    for (const facet of style.discoveryFacets) {
      if (!labelKind.has(facet.label)) labelKind.set(facet.label, facet.kind);
    }
  }
  return Array.from(labelKind.entries())
    .sort((a, b) => HASHTAG_KIND_ORDER.indexOf(a[1]) - HASHTAG_KIND_ORDER.indexOf(b[1]))
    .map(([label]) => label);
}

export function StyleWaterfallGridClient({ styles }: StyleWaterfallGridClientProps) {
  const [activeTab, setActiveTab] = useState<TabLabel>('Trending');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const { savedIds } = useSavedStyles();

  const availableTags = useMemo(() => collectFacetLabels(styles), [styles]);

  function toggleTag(label: string) {
    setSelectedTags((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const tabStyles =
    activeTab === 'Saved' ? styles.filter((s) => savedIds.has(s.id)) : styles;

  // OR match: a style stays if it carries any selected tag. No selection = everything.
  const visibleStyles =
    selectedTags.size === 0
      ? tabStyles
      : tabStyles.filter((style) => style.discoveryFacets.some((facet) => selectedTags.has(facet.label)));

  return (
    <section className="xhs-feed" aria-label="Style discovery feed">
      {/* XHS-style top tab switcher */}
      <div className="xhs-tab-row" role="tablist" aria-label="Feed type">
        {tabs.map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'xhs-tab xhs-tab-active' : 'xhs-tab'}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {availableTags.length > 0 ? (
        <div className="feed-filter-bar" role="group" aria-label="Filter by tag">
          {selectedTags.size > 0 ? (
            <button className="feed-filter-clear" type="button" onClick={() => setSelectedTags(new Set())}>
              清除
            </button>
          ) : null}
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={selectedTags.has(tag)}
              className={`feed-filter-chip${selectedTags.has(tag) ? ' feed-filter-chip-active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}

      {/* 2-column masonry grid */}
      {visibleStyles.length === 0 ? (
        <EmptyState
          title={selectedTags.size > 0 ? 'No looks match those tags' : 'No saved looks yet'}
          body={
            selectedTags.size > 0
              ? 'Try removing a tag, or clear the filter to see everything.'
              : 'Tap the heart on any style to save it here.'
          }
        />
      ) : (
        <div className="xhs-grid">
          {visibleStyles.map((style) => (
            <StyleCard key={style.id} style={style} onTagClick={toggleTag} activeTags={selectedTags} />
          ))}
        </div>
      )}
    </section>
  );
}
