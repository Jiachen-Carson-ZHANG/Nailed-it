'use client';

import Link from 'next/link';
import type { NailStyleCard } from '@/domain/nail';
import { getCustomerStylePath } from '@/domain/session';
import { useSavedStyles } from './SavedStylesContext';

type StyleCardProps = {
  style: NailStyleCard;
};

export function StyleCard({ style }: StyleCardProps) {
  const { isSaved, toggle } = useSavedStyles();
  const saved = isSaved(style.id);

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
        <div className="xhs-card-meta">
          <span className="xhs-card-price">${style.previewQuote.price}</span>
        </div>
      </div>
    </div>
  );
}
