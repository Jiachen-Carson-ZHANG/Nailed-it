'use client';

import Link from 'next/link';
import type { NailStyleCard } from '@/domain/nail';
import { getCustomerStylePath } from '@/domain/session';
import { demoCustomerId } from '@/mock/customers';
import { track } from '@/features/analytics/track';
import { cardFacetLabels } from './style-facets';
import { useSavedStyles } from './SavedStylesContext';

type StyleCardProps = {
  style: NailStyleCard;
  /** When provided, the card tags become buttons that toggle the matching feed filter. */
  onTagClick?: (label: string) => void;
  activeTags?: ReadonlySet<string>;
  /** Personalized "why recommended" chip from the ranking function (ADR-0006). */
  reason?: string;
};

export function StyleCard({ style, onTagClick, activeTags, reason }: StyleCardProps) {
  const { isSaved, toggle } = useSavedStyles();
  const saved = isSaved(style.id);
  const tags = cardFacetLabels(style.discoveryFacets);

  return (
    <div className="xhs-card">
      <Link
        aria-label={`${style.title} — from $${style.previewQuote.price}`}
        className="xhs-card-link"
        href={getCustomerStylePath(style.id)}
        onClick={() =>
          track('style_card_click', {
            styleId: style.id,
            customerId: demoCustomerId,
            eventSource: 'customer_home_feed',
          })
        }
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
        onClick={() => {
          // Log only the save (heart on), not un-save, so the profile reflects positive intent.
          if (!saved) {
            track('style_save', {
              styleId: style.id,
              customerId: demoCustomerId,
              eventSource: 'customer_home_feed',
            });
          }
          toggle(style.id);
        }}
      >
        {saved ? '♥' : '♡'}
      </button>

      <div className="xhs-card-info">
        {reason ? <p className="xhs-card-reason">{reason}</p> : null}
        <p className="xhs-card-title">{style.title}</p>
        {tags.length > 0 ? (
          <div className="xhs-card-tags">
            {tags.map((tag) =>
              onTagClick ? (
                <button
                  key={tag}
                  className={`xhs-card-shape${activeTags?.has(tag) ? ' xhs-card-shape-active' : ''}`}
                  type="button"
                  onClick={() => onTagClick(tag)}
                >
                  {tag}
                </button>
              ) : (
                <span key={tag} className="xhs-card-shape">{tag}</span>
              ),
            )}
          </div>
        ) : null}
        <div className="xhs-card-meta">
          <span className="xhs-card-price">${style.previewQuote.price}</span>
        </div>
      </div>
    </div>
  );
}
