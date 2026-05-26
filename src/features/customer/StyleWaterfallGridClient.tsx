'use client';

import { useState, useMemo } from 'react';
import type { NailStyleCard, StyleDiscoveryFacetKind } from '@/domain/nail';
import { EmptyState } from '@/components/ui/EmptyState';
import { StyleCard } from './StyleCard';

type StyleWaterfallGridClientProps = {
  styles: NailStyleCard[];
};

const facetLabels: Partial<Record<StyleDiscoveryFacetKind, string>> = {
  style: 'Style',
  mood: 'Vibe',
  lifestyle: 'Occasion',
  shape: 'Shape',
  addon: 'Add-ons'
};

const tabs = ['Trending', 'Saved'] as const;
type TabLabel = typeof tabs[number];

export function StyleWaterfallGridClient({ styles }: StyleWaterfallGridClientProps) {
  const [activeTab, setActiveTab] = useState<TabLabel>('Trending');
  const [activeKind, setActiveKind] = useState<StyleDiscoveryFacetKind | null>(null);

  const availableKinds = useMemo(() => {
    const kinds = new Set<StyleDiscoveryFacetKind>();
    styles.forEach((s) => s.discoveryFacets.forEach((f) => kinds.add(f.kind)));
    return (Object.keys(facetLabels) as StyleDiscoveryFacetKind[]).filter((k) => kinds.has(k));
  }, [styles]);

  const filtered = useMemo(() => {
    if (activeTab === 'Saved') return [];
    return activeKind
      ? styles.filter((s) => s.discoveryFacets.some((f) => f.kind === activeKind))
      : styles;
  }, [styles, activeKind, activeTab]);

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
            onClick={() => { setActiveTab(tab); setActiveKind(null); }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Horizontally scrollable filter chips */}
      <div className="xhs-chip-scroll" role="group" aria-label="Filter by type">
        <button
          type="button"
          className={activeKind === null ? 'xhs-chip xhs-chip-active' : 'xhs-chip'}
          onClick={() => setActiveKind(null)}
        >
          All
        </button>
        {availableKinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className={activeKind === kind ? 'xhs-chip xhs-chip-active' : 'xhs-chip'}
            onClick={() => setActiveKind(activeKind === kind ? null : kind)}
          >
            {facetLabels[kind]}
          </button>
        ))}
      </div>

      {/* 2-column masonry grid */}
      {activeTab === 'Saved' ? (
        <EmptyState
          title="No saved looks yet"
          body="Tap the heart on any style to save it here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" body="Try a different filter." />
      ) : (
        <div className="xhs-grid">
          {filtered.map((style) => (
            <StyleCard key={style.id} style={style} />
          ))}
        </div>
      )}
    </section>
  );
}
