'use client';

import { useState } from 'react';
import { STATIC_TRENDING, type StaticTrendingStyle } from './trending-data';

const RANK_EMOJI = ['①', '②', '③'];

function TrendingRow({ style }: { style: StaticTrendingStyle }) {
  const rankGlyph = RANK_EMOJI[style.rank - 1] ?? String(style.rank);
  return (
    <div className="trending-row">
      <span className="trending-rank" aria-label={`Rank ${style.rank}`}>{rankGlyph}</span>
      <span className="trending-name">{style.nameCn}</span>
    </div>
  );
}

export function TrendingStylesPanel() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="trending-panel" aria-labelledby="trending-panel-title">
      <button
        type="button"
        className="trending-panel-toggle"
        aria-expanded={expanded}
        aria-controls="trending-panel-body"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="trending-panel-heading-row">
          <h2 id="trending-panel-title" className="trending-panel-title">热门款式</h2>
          <span className="trending-panel-subtitle">AI自动识别抓取近期热门款式</span>
        </div>
        <svg
          className="trending-panel-chevron"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="none"
          width="16"
          height="16"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
        >
          <polyline points="5,7 10,13 15,7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>
      <div id="trending-panel-body" className="trending-list" style={expanded ? undefined : { display: 'none' }}>
        {STATIC_TRENDING.map((style) => (
          <TrendingRow key={style.rank} style={style} />
        ))}
      </div>
    </section>
  );
}
