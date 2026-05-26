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
  mood: 'Mood',
  lifestyle: 'Occasion',
  shape: 'Shape'
};

export function StyleWaterfallGridClient({ styles }: StyleWaterfallGridClientProps) {
  const [activeKind, setActiveKind] = useState<StyleDiscoveryFacetKind | null>(null);

  const availableKinds = useMemo(() => {
    const kinds = new Set<StyleDiscoveryFacetKind>();
    styles.forEach((s) => s.discoveryFacets.forEach((f) => kinds.add(f.kind)));
    return (Object.keys(facetLabels) as StyleDiscoveryFacetKind[]).filter((k) => kinds.has(k));
  }, [styles]);

  const filtered = useMemo(
    () =>
      activeKind
        ? styles.filter((s) => s.discoveryFacets.some((f) => f.kind === activeKind))
        : styles,
    [styles, activeKind]
  );

  if (styles.length === 0) {
    return (
      <section aria-labelledby="trending-style-grid-title" className="discovery-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Trending now</p>
            <h2 id="trending-style-grid-title">Discover trending nail looks</h2>
          </div>
        </div>
        <EmptyState body="No trending styles right now — check back soon." title="No styles yet" />
      </section>
    );
  }

  return (
    <section aria-labelledby="trending-style-grid-title" className="discovery-section">
      <div className="section-heading">
        <div>
          <p className="section-eyebrow">Trending now</p>
          <h2 id="trending-style-grid-title">Discover trending nail looks</h2>
        </div>
      </div>
      <div className="chip-row" role="group" aria-label="Filter by type">
        <button
          className={activeKind === null ? 'chip chip-selected' : 'chip'}
          onClick={() => setActiveKind(null)}
          type="button"
        >
          All
        </button>
        {availableKinds.map((kind) => (
          <button
            key={kind}
            className={activeKind === kind ? 'chip chip-selected' : 'chip'}
            onClick={() => setActiveKind(kind)}
            type="button"
          >
            {facetLabels[kind]}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState body="No styles match this filter." title="No matches" />
      ) : (
        <div className="style-waterfall-grid">
          {filtered.map((style) => (
            <StyleCard key={style.id} style={style} />
          ))}
        </div>
      )}
    </section>
  );
}
