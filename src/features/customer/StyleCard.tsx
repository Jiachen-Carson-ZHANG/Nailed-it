import Link from 'next/link';
import type { NailStyleCard } from '@/domain/nail';
import { getCustomerStylePath } from '@/domain/session';

type StyleCardProps = {
  style: NailStyleCard;
};

export function StyleCard({ style }: StyleCardProps) {
  return (
    <Link
      aria-label={`${style.title} — from $${style.previewQuote.price}`}
      className="xhs-card"
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
      <div className="xhs-card-info">
        <p className="xhs-card-title">{style.title}</p>
        <div className="xhs-card-meta">
          <span className="xhs-card-price">${style.previewQuote.price}</span>
          <span className="xhs-card-score" aria-label={`${style.popularityScore} bookings`}>
            ♥ {style.popularityScore}
          </span>
        </div>
      </div>
    </Link>
  );
}
