import Link from 'next/link';
import type { NailStyleCard } from '@/domain/nail';
import { getCustomerStylePath } from '@/domain/session';

type StyleCardProps = {
  style: NailStyleCard;
};

export function StyleCard({ style }: StyleCardProps) {
  return (
    <Link
      aria-label={style.title}
      className="style-card"
      href={getCustomerStylePath(style.id)}
    >
      <div className="style-card-media">
        <img
          alt={style.title}
          className="style-card-image"
          loading="lazy"
          src={style.imageUrl}
        />
      </div>
      <div className="style-card-body">
        <div className="style-card-header">
          <div>
            <h3>{style.title}</h3>
            <p>From ${style.previewQuote.price} · {style.previewQuote.duration} min</p>
          </div>
          <span className="style-score" aria-label={`${style.popularityScore} recent bookings`}>★ {style.popularityScore}</span>
        </div>
        <div className="style-tag-row" aria-label={`${style.title} tags`}>
          {style.discoveryFacets.map((facet) => (
            <span key={`${facet.kind}-${facet.label}`} className={`style-tag style-tag-${facet.kind}`}>
              {facet.label}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
