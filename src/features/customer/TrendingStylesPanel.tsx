'use client';

import { useState } from 'react';
import type { AITrendingResponse, AITrendingStyle } from '@/domain/nail';
import { Button } from '@/components/ui/Button';

const RANK_EMOJI = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

type TrendingCardProps = {
  style: AITrendingStyle;
};

function TrendingCard({ style }: TrendingCardProps) {
  const rankGlyph = RANK_EMOJI[style.rank - 1] ?? String(style.rank);

  return (
    <article className="trending-card">
      <div className="trending-card-header">
        <span className="trending-rank" aria-label={`Rank ${style.rank}`}>{rankGlyph}</span>
        <div>
          <h3 className="trending-name">{style.name}</h3>
          <p className="trending-name-cn">{style.nameCn}</p>
        </div>
      </div>
      <p className="trending-description">{style.description}</p>
      {style.tags.length > 0 && (
        <div className="trending-tags" aria-label="Style tags">
          {style.tags.map((tag) => (
            <span key={tag} className="style-tag style-tag-readonly">{tag}</span>
          ))}
        </div>
      )}
      {style.searchLinks.length > 0 && (
        <div className="trending-links" aria-label="Explore on">
          {style.searchLinks.map((link) => (
            <a
              key={link.platform}
              className="trending-link"
              href={link.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

function TrendingCardSkeleton() {
  return (
    <div className="trending-card trending-card-skeleton" aria-hidden="true">
      <div className="skeleton-line skeleton-line-short" />
      <div className="skeleton-line" />
      <div className="skeleton-line skeleton-line-medium" />
    </div>
  );
}

export function TrendingStylesPanel() {
  const [data, setData] = useState<AITrendingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasFetched, setHasFetched] = useState(false);

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
      setHasFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trending styles.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="trending-panel" aria-labelledby="trending-panel-title">
      <div className="trending-panel-header">
        <div>
          <h2 id="trending-panel-title" className="trending-panel-title">Trending Now</h2>
          <p className="trending-panel-subtitle">热门款式</p>
        </div>
        <Button
          size="compact"
          variant={hasFetched ? 'secondary' : 'primary'}
          onClick={loadTrending}
          disabled={isLoading}
        >
          {isLoading ? 'Loading…' : hasFetched ? 'Refresh' : 'Load trends'}
        </Button>
      </div>

      {error && (
        <section className="summary-card" role="alert">
          <strong>Could not load trends</strong>
          <p>{error}</p>
        </section>
      )}

      {isLoading && (
        <div className="trending-grid" aria-busy="true" aria-label="Loading trending styles">
          {Array.from({ length: 4 }, (_, i) => <TrendingCardSkeleton key={i} />)}
        </div>
      )}

      {!isLoading && data && (
        <div className="trending-grid">
          {data.styles.map((style) => (
            <TrendingCard key={style.rank} style={style} />
          ))}
        </div>
      )}

      {!isLoading && !data && !error && (
        <p className="helper-copy">Tap "Load trends" to see what&apos;s trending right now.</p>
      )}
    </section>
  );
}
