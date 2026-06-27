'use client';

import { useState } from 'react';
import { useLanguage } from '@/i18n/context';
import { TrendingStylesPanel } from './TrendingStylesPanel';
import { PublishedStyleFeed } from './PublishedStyleFeed';

export function CustomerHomeClient() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <>
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
      <TrendingStylesPanel />
      <PublishedStyleFeed searchQuery={searchQuery} />
    </>
  );
}
