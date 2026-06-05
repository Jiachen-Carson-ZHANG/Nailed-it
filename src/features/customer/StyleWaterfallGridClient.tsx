'use client';

import { useState } from 'react';
import type { NailStyleCard } from '@/domain/nail';
import { EmptyState } from '@/components/ui/EmptyState';
import { StyleCard } from './StyleCard';
import { useSavedStyles } from './SavedStylesContext';

type StyleWaterfallGridClientProps = {
  styles: NailStyleCard[];
};

const tabs = ['Trending', 'Saved'] as const;
type TabLabel = typeof tabs[number];

export function StyleWaterfallGridClient({ styles }: StyleWaterfallGridClientProps) {
  const [activeTab, setActiveTab] = useState<TabLabel>('Trending');
  const { savedIds } = useSavedStyles();

  const visibleStyles =
    activeTab === 'Saved'
      ? styles.filter((s) => savedIds.has(s.id))
      : styles;

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

      {/* 2-column masonry grid */}
      {visibleStyles.length === 0 ? (
        <EmptyState
          title="No saved looks yet"
          body="Tap the heart on any style to save it here."
        />
      ) : (
        <div className="xhs-grid">
          {visibleStyles.map((style) => (
            <StyleCard key={style.id} style={style} />
          ))}
        </div>
      )}
    </section>
  );
}
