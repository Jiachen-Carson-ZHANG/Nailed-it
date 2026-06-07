'use client';

import { useMemo, useState } from 'react';
import type { NailStyleCard } from '@/domain/nail';
import { EmptyState } from '@/components/ui/EmptyState';
import { StyleCard } from './StyleCard';
import { cleanFacetLabels, groupLabelsBySection } from './style-facets';
import { useSavedStyles } from './SavedStylesContext';

type StyleWaterfallGridClientProps = {
  styles: NailStyleCard[];
};

const tabs = ['Trending', 'Saved'] as const;
type TabLabel = typeof tabs[number];

export function StyleWaterfallGridClient({ styles }: StyleWaterfallGridClientProps) {
  const [activeTab, setActiveTab] = useState<TabLabel>('Trending');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [openSection, setOpenSection] = useState<string | null>(null);
  const { savedIds } = useSavedStyles();

  // Distinct, categorized labels across the loaded feed, grouped into filter sections (甲形 / 颜色 /
  // 效果 / …). Service-module containers and uncategorizable labels are dropped.
  const filterGroups = useMemo(() => {
    const all: string[] = [];
    for (const style of styles) {
      for (const label of cleanFacetLabels(style.discoveryFacets)) {
        if (!all.includes(label)) all.push(label);
      }
    }
    return groupLabelsBySection(all);
  }, [styles]);

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

      {filterGroups.length > 0 ? (
        <div className="feed-filter">
          <div className="feed-filter-bar" role="group" aria-label="Filter by tag">
            {filterGroups.map(({ section, labels }) => {
              const activeCount = labels.filter((label) => selectedTags.has(label)).length;
              const open = openSection === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  aria-expanded={open}
                  className={`feed-filter-summary${activeCount > 0 || open ? ' feed-filter-summary-on' : ''}`}
                  onClick={() => setOpenSection(open ? null : section.key)}
                >
                  <span>
                    {section.label}
                    {activeCount > 0 ? ` · ${activeCount}` : ''}
                  </span>
                  <span
                    className={`feed-filter-summary-caret${open ? ' feed-filter-summary-caret-open' : ''}`}
                    aria-hidden
                  >
                    ▾
                  </span>
                </button>
              );
            })}
            {selectedTags.size > 0 ? (
              <button className="feed-filter-clear" type="button" onClick={() => setSelectedTags(new Set())}>
                清除 ✕
              </button>
            ) : null}
          </div>
          {openSection ? (
            <div className="feed-filter-tray">
              {filterGroups
                .find((group) => group.section.key === openSection)
                ?.labels.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={selectedTags.has(tag)}
                    className={`feed-filter-chip${selectedTags.has(tag) ? ' feed-filter-chip-active' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
            </div>
          ) : null}
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
