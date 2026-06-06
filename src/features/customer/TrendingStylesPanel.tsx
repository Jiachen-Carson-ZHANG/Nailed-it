'use client';

import { useEffect, useRef, useState } from 'react';
import type { AITrendingResponse, AITrendingStyle } from '@/domain/nail';
import { Button } from '@/components/ui/Button';

const RANK_EMOJI = ['①', '②', '③'];
const TOP_N = 3;

const PLATFORM_SHORT: Record<string, string> = {
  Pinterest: 'Pinterest',
  Xiaohongshu: '小红书',
  TikTok: 'TikTok',
  'Google Images': 'Google',
};

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
  const [data, setData] = useState<AITrendingResponse | null>(null);
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

      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trending styles.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // 中文注释：开发环境下 React Strict Mode 会重复触发 effect，这里挡掉首次重复请求。
    if (hasAutoLoadedRef.current) return;

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
