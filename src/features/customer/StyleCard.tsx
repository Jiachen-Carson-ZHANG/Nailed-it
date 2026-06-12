'use client';

import Link from 'next/link';
import type { NailStyleCard } from '@/domain/nail';
import { getCustomerStylePath } from '@/domain/session';
import { demoCustomerId } from '@/mock/customers';
import { track } from '@/features/analytics/track';
import { cardFacetLabels } from './style-facets';
import { useSavedStyles } from './SavedStylesContext';
import { useLanguage } from '@/i18n/context';
import { formatCurrency } from '@/i18n/format';
import { useCurrency } from '@/i18n/currency-context';

type StyleCardProps = {
  style: NailStyleCard;
  /** When provided, the card tags become buttons that toggle the matching feed filter. */
  onTagClick?: (label: string) => void;
  activeTags?: ReadonlySet<string>;
};

export function StyleCard({ style, onTagClick, activeTags }: StyleCardProps) {
  const { isSaved, toggle } = useSavedStyles();
  const { t, language } = useLanguage();
  const { currency } = useCurrency();
  const saved = isSaved(style.id);
  const tags = cardFacetLabels(style.discoveryFacets);
  const priceLabel = formatCurrency({ cents: Math.round(style.previewQuote.price * 100), language, currency });
  const linkAria =
    language === 'zh-CN'
      ? `${style.title}，参考价 ${priceLabel}`
      : `${style.title} — from ${priceLabel}`;

  return (
    <div className="xhs-card">
      <Link
        aria-label={linkAria}
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
        aria-label={saved ? t('feed.card.unsave') : t('feed.card.save')}
        aria-pressed={saved}
        className={`xhs-save-btn${saved ? ' xhs-save-btn-saved' : ''}`}
        type="button"
        onClick={() => {
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
          <span className="xhs-card-price">{priceLabel}</span>
        </div>
      </div>
    </div>
  );
}
