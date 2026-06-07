'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { NailStyleCard } from '@/domain/nail';
import { EmptyState } from '@/components/ui/EmptyState';
import { demoCustomerId } from '@/mock/customers';
import { track } from '@/features/analytics/track';
import { StyleCard } from './StyleCard';
import { cleanFacetLabels, groupLabelsBySection } from './style-facets';
import { useSavedStyles } from './SavedStylesContext';
import { useLanguage } from '@/i18n/context';

type StyleWaterfallGridClientProps = {
  styles: NailStyleCard[];
  /** styleId → personalized reason chip, from the ranking function (Melissa's feed). */
  reasonByStyleId?: Record<string, string>;
};

type FeedTab = 'trending' | 'saved';

export function StyleWaterfallGridClient({ styles }: StyleWaterfallGridClientProps) {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<FeedTab>('trending');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [openSection, setOpenSection] = useState<string | null>(null);
  const { savedIds } = useSavedStyles();

  const filterGroups = useMemo(() => {
    const all: string[] = [];
    for (const style of styles) {
      for (const label of cleanFacetLabels(style.discoveryFacets)) {
        if (!all.includes(label)) all.push(label);
      }
    }
    return groupLabelsBySection(all, language);
  }, [styles, language]);

  function toggleTag(label: string) {
    const adding = !selectedTags.has(label);
    setSelectedTags((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
    if (adding) {
      track('search_submitted', {
        query: label,
        customerId: demoCustomerId,
        eventSource: 'home_feed_filter',
      });
    }
  }

  const tabStyles =
    activeTab === 'saved' ? styles.filter((s) => savedIds.has(s.id)) : styles;

  const visibleStyles =
    selectedTags.size === 0
      ? tabStyles
      : tabStyles.filter((style) => style.discoveryFacets.some((facet) => selectedTags.has(facet.label)));

  const lastNoResultKey = useRef<string | null>(null);
  useEffect(() => {
    if (selectedTags.size > 0 && visibleStyles.length === 0) {
      const key = Array.from(selectedTags).sort().join('|');
      if (lastNoResultKey.current !== key) {
        lastNoResultKey.current = key;
        track('search_no_result', {
          query: key,
          customerId: demoCustomerId,
          eventSource: 'home_feed_filter',
        });
      }
    }
  }, [selectedTags, visibleStyles.length]);

  const tabs: { id: FeedTab; label: string }[] = [
    { id: 'trending', label: t('feed.tabTrending') },
    { id: 'saved', label: t('feed.tabSaved') },
  ];

  const emptyTitle =
    selectedTags.size > 0
      ? t('feed.emptyNoMatchTitle')
      : activeTab === 'saved'
        ? t('feed.emptySavedTitle')
        : t('feed.emptyNoMatchTitle');
  const emptyBody =
    selectedTags.size > 0
      ? t('feed.emptyNoMatchBody')
      : activeTab === 'saved'
        ? t('feed.emptySavedBody')
        : t('feed.emptyNoMatchBody');

  return (
    <section className="xhs-feed" aria-label={t('feed.aria')}>
      <div className="xhs-tab-row" role="tablist" aria-label={t('feed.tabListAria')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'xhs-tab xhs-tab-active' : 'xhs-tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filterGroups.length > 0 ? (
        <div className="feed-filter">
          <div className="feed-filter-bar" role="group" aria-label={t('feed.filterAria')}>
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
                {t('feed.clearFilters')}
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

      {visibleStyles.length === 0 ? (
        <EmptyState title={emptyTitle} body={emptyBody} />
      ) : (
        <div className="xhs-grid">
          {visibleStyles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              onTagClick={toggleTag}
              activeTags={selectedTags}
            />
          ))}
        </div>
      )}
    </section>
  );
}
