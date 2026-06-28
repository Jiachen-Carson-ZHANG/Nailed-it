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

export function StyleWaterfallGridClient({ styles }: StyleWaterfallGridClientProps) {
  const { t, language } = useLanguage();
  const [showSaved, setShowSaved] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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

  const savedCount = styles.filter((s) => savedIds.has(s.id)).length;

  const tabStyles =
    showSaved ? styles.filter((s) => savedIds.has(s.id)) : styles;

  const searchFiltered =
    searchQuery.trim() === ''
      ? tabStyles
      : tabStyles.filter((s) => {
          const q = searchQuery.trim().toLowerCase();
          const title = s.title?.toLowerCase() ?? '';
          return title.includes(q);
        });

  const visibleStyles =
    selectedTags.size === 0
      ? searchFiltered
      : searchFiltered.filter((style) => style.discoveryFacets.some((facet) => selectedTags.has(facet.label)));

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

  const emptyTitle =
    selectedTags.size > 0
      ? t('feed.emptyNoMatchTitle')
      : showSaved
        ? t('feed.emptySavedTitle')
        : t('feed.emptyNoMatchTitle');
  const emptyBody =
    selectedTags.size > 0
      ? t('feed.emptyNoMatchBody')
      : showSaved
        ? t('feed.emptySavedBody')
        : t('feed.emptyNoMatchBody');

  return (
    <section className="xhs-feed" aria-label={t('feed.aria')}>
      <div className="feed-search">
        <div className="feed-search-wrap">
          <svg className="feed-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.25" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12.5" y1="12.5" x2="16.5" y2="16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('feed.searchPlaceholder')}
            aria-label={t('feed.searchPlaceholder')}
          />
        </div>
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

      <button
        type="button"
        aria-label={t('feed.tabSaved')}
        aria-pressed={showSaved}
        className={`feed-cart-fab${showSaved ? ' feed-cart-fab-active' : ''}`}
        onClick={() => setShowSaved((v) => !v)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {savedCount > 0 && (
          <span className="feed-cart-fab-badge">{savedCount}</span>
        )}
      </button>
    </section>
  );
}
