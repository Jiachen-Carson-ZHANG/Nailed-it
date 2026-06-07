'use client';

import Link from 'next/link';
import type { NailStyleCard, StyleDiscoveryFacet, StyleDiscoveryFacetKind } from '@/domain/nail';
import { getCustomerStylePath } from '@/domain/session';
import { useSavedStyles } from './SavedStylesContext';

type StyleCardProps = {
  style: NailStyleCard;
  /** When provided, hashtags become buttons that toggle the matching feed filter. */
  onTagClick?: (label: string) => void;
  activeTags?: ReadonlySet<string>;
};

// Chip ordering for the feed filter bar (most descriptive facet kinds first).
export const HASHTAG_KIND_ORDER: StyleDiscoveryFacetKind[] = ['style', 'addon', 'shape', 'mood', 'lifestyle'];

// The card shows just the nail shape (杏仁形 / 方圆形 …) as a quick, scannable descriptor.
function styleShape(facets: StyleDiscoveryFacet[]): string | null {
  return facets.find((facet) => facet.kind === 'shape')?.label ?? null;
}

export function StyleCard({ style, onTagClick, activeTags }: StyleCardProps) {
  const { isSaved, toggle } = useSavedStyles();
  const saved = isSaved(style.id);
  const shape = styleShape(style.discoveryFacets);

  return (
    <div className="xhs-card">
      <Link
        aria-label={`${style.title} — from $${style.previewQuote.price}`}
        className="xhs-card-link"
        href={getCustomerStylePath(style.id)}
      >
        <div className="xhs-card-image-wrap">
          <img
            alt={style.title}
            className="xhs-card-image"
            loading="lazy"
            src={style.imageUrl}
          />
        </div>
      </Link>

      <button
        aria-label={saved ? 'Remove from saved' : 'Save this style'}
        aria-pressed={saved}
        className={`xhs-save-btn${saved ? ' xhs-save-btn-saved' : ''}`}
        type="button"
        onClick={() => toggle(style.id)}
      >
        {saved ? '♥' : '♡'}
      </button>

      <div className="xhs-card-info">
        <p className="xhs-card-title">{style.title}</p>
        {shape ? (
          onTagClick ? (
            <button
              className={`xhs-card-shape${activeTags?.has(shape) ? ' xhs-card-shape-active' : ''}`}
              type="button"
              onClick={() => onTagClick(shape)}
            >
              {shape}
            </button>
          ) : (
            <span className="xhs-card-shape">{shape}</span>
          )
        ) : null}
        <div className="xhs-card-meta">
          <span className="xhs-card-price">${style.previewQuote.price}</span>
        </div>
      </div>
    </div>
  );
}
