'use client';

import { useRef, useState } from 'react';
import { useLanguage } from '@/i18n/context';
import { getBrowserStorage } from '@/lib/browser-storage';
import { CollageHousePanel } from './CollageHousePanel';
import { PublishedStyleFeed } from './PublishedStyleFeed';
import { SearchDropdown } from './SearchDropdown';

const HISTORY_KEY = 'nailed-search-history';

function saveSearchHistory(term: string) {
  const storage = getBrowserStorage('local');
  if (!storage) return;
  try {
    const raw = storage.getItem(HISTORY_KEY);
    const existing: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [term, ...existing.filter((t) => t !== term)].slice(0, 8);
    storage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function CustomerHomeClient() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  function handleFocus() {
    setDropdownOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && searchQuery.trim()) {
      saveSearchHistory(searchQuery.trim());
      setDropdownOpen(false);
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    // Only save on blur if focus moves outside the search container
    const relatedTarget = e.relatedTarget as Node | null;
    if (searchRef.current && relatedTarget && searchRef.current.contains(relatedTarget)) return;
    if (searchQuery.trim()) {
      saveSearchHistory(searchQuery.trim());
    }
  }

  return (
    <>
      <div ref={searchRef} className="feed-search feed-search-container">
        <div className="feed-search-wrap">
          <svg className="feed-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.25" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12.5" y1="12.5" x2="16.5" y2="16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={t('feed.searchPlaceholder')}
            aria-label={t('feed.searchPlaceholder')}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
          />
        </div>
        <SearchDropdown
          open={dropdownOpen}
          onClose={() => setDropdownOpen(false)}
          onSelectHistory={(term) => {
            setSearchQuery(term);
            setDropdownOpen(false);
          }}
        />
      </div>
      <CollageHousePanel />
      <PublishedStyleFeed searchQuery={searchQuery} />
    </>
  );
}
