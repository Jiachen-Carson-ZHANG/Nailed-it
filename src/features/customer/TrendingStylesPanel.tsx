'use client';

import { useEffect, useRef, useState } from 'react';
import type { AITrendingResponse, AITrendingStyle } from '@/domain/nail';
import { Button } from '@/components/ui/Button';

const RANK_EMOJI = ['①', '②', '③'];
const TOP_N = 3;

// Module-level cache: the trending feed is a live web search, so it should run once per session, not
// every time the customer returns to home. Refresh still forces a fresh fetch.
let trendingCache: AITrendingResponse | null = null;

/** Test-only: clear the session cache so each case starts from a clean fetch. */
export function resetTrendingCacheForTests() {
  trendingCache = null;
}

const PLATFORM_SHORT: Record<string, string> = {
  Pinterest: 'Pinterest',
  Xiaohongshu: '小红书',
  TikTok: 'TikTok',
  Douyin: '抖音',
  'Google Images': 'Google',
};

function handleMobileAppLink(e: React.MouseEvent<HTMLAnchorElement>, link: { url: string; appUrl?: string }) {
  if (!link.appUrl) return;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) return;

  e.preventDefault();

  let appOpened = false;

  const cancelFallback = () => {
    if (!appOpened) {
      appOpened = true;
      clearTimeout(timer);
    }
  };

  const timer = setTimeout(() => {
    if (!appOpened) window.open(link.url, '_blank', 'noopener,noreferrer');
  }, 1500);

  // visibilitychange fires on iOS; blur/pagehide fire on Android — listen to all three
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelFallback(); }, { once: true });
  window.addEventListener('blur', cancelFallback, { once: true });
  window.addEventListener('pagehide', cancelFallback, { once: true });

  window.location.href = link.appUrl;
}

function TrendingRow({ style }: { style: AITrendingStyle }) {
  const rankGlyph = RANK_EMOJI[style.rank - 1] ?? String(style.rank);
  const links = style.searchLinks.filter((l) => l.platform !== 'Google Images');
  return (
    <div className="trending-row">
      <span className="trending-rank" aria-label={`Rank ${style.rank}`}>{rankGlyph}</span>
      <span className="trending-name">{style.nameCn}</span>
      {links.length > 0 && (
        <span className="trending-row-links">
          {links.map((link) => (
            <a
              key={link.platform}
              className="trending-link"
              href={link.url}
              rel="noopener noreferrer"
              target="_blank"
              onClick={(e) => handleMobileAppLink(e, link)}
            >
              {PLATFORM_SHORT[link.platform] ?? link.label}
            </a>
          ))}
        </span>
      )}
    </div>
  );
}

function TrendingRowSkeleton() {
  return (
    <div className="trending-row trending-row-skeleton" aria-hidden="true">
      <div className="skeleton-line skeleton-line-medium" />
    </div>
  );
}

export function TrendingStylesPanel() {
  const [data, setData] = useState<AITrendingResponse | null>(trendingCache);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const hasAutoLoadedRef = useRef(false);

  async function loadTrending() {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/ai/trending-styles');
      const body = (await response.json()) as AITrendingResponse & { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? 'Failed to load trending styles.');
      }

      trendingCache = body;
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trending styles.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // Run the live search at most once per session. Returning to home reuses the cached result;
    // the Refresh button is the explicit way to fetch again.
    if (hasAutoLoadedRef.current || trendingCache) return;

    hasAutoLoadedRef.current = true;
    void loadTrending();
  }, []);

  return (
    <section className="trending-panel" aria-labelledby="trending-panel-title">
      <div className="trending-panel-header">
        <div>
          <h2 id="trending-panel-title" className="trending-panel-title">热门款式</h2>
          <p className="trending-panel-subtitle">AI自动识别抓取近期热门款式</p>
        </div>
        <Button
          size="compact"
          variant="secondary"
          onClick={loadTrending}
          disabled={isLoading}
        >
          {isLoading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <section className="summary-card" role="alert">
          <strong>Could not load trends</strong>
          <p>{error}</p>
        </section>
      )}

      {isLoading && (
        <div className="trending-list" aria-busy="true" aria-label="Loading trending styles">
          {Array.from({ length: TOP_N }, (_, i) => <TrendingRowSkeleton key={i} />)}
        </div>
      )}

      {!isLoading && data && (
        <div className="trending-list">
          {data.styles.slice(0, TOP_N).map((style) => (
            <TrendingRow key={style.rank} style={style} />
          ))}
        </div>
      )}
    </section>
  );
}
