'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/i18n/context';
import { getBrowserStorage } from '@/lib/browser-storage';
import { getCustomerStylePath } from '@/domain/session';
import { STATIC_TRENDING } from './trending-data';

const HISTORY_KEY = 'nailed-search-history';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelectHistory: (term: string) => void;
};

export function SearchDropdown({ open, onClose, onSelectHistory }: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const [history, setHistory] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storage = getBrowserStorage('local');
    if (!storage) return;
    try {
      const raw = storage.getItem(HISTORY_KEY);
      setHistory(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setHistory([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  function clearHistory() {
    const storage = getBrowserStorage('local');
    storage?.removeItem(HISTORY_KEY);
    setHistory([]);
  }

  return (
    <div ref={ref} className="search-dropdown" role="listbox" aria-label={t('search.historyTitle')}>
      {history.length > 0 && (
        <div className="search-dropdown-section">
          <div className="search-dropdown-section-header">
            <span className="search-dropdown-section-label">{t('search.historyTitle')}</span>
            <button
              type="button"
              className="search-dropdown-clear-btn"
              aria-label={t('search.clearHistory')}
              onClick={clearHistory}
            >
              🗑️
            </button>
          </div>
          <div className="search-dropdown-history-pills">
            {history.map((term) => (
              <button
                key={term}
                type="button"
                className="search-dropdown-history-pill"
                onClick={() => onSelectHistory(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="search-dropdown-section">
        <div className="search-dropdown-section-header">
          <span className="search-dropdown-section-label">{t('search.trendingTitle')}</span>
        </div>
        <div className="search-dropdown-trending-list">
          {STATIC_TRENDING.map((style) => (
            <button
              key={style.rank}
              type="button"
              className="search-dropdown-trending-row"
              onClick={() => { router.push(getCustomerStylePath(style.styleId)); onClose(); }}
            >
              <span className="search-dropdown-trending-rank" aria-hidden="true">
                {['①', '②', '③'][style.rank - 1] ?? String(style.rank)}
              </span>
              <span className="search-dropdown-trending-name">{style.nameCn}</span>
              <span className="search-dropdown-trending-arrow" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
