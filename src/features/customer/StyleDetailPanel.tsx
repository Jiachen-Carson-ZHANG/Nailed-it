import Link from 'next/link';
import type { NailStyleCard } from '@/domain/nail';
import { getCustomerBookingPath, getCustomerTryOnPath } from '@/domain/session';

type StyleDetailPanelProps = {
  style: NailStyleCard;
};

export function StyleDetailPanel({ style }: StyleDetailPanelProps) {
  const { previewQuote } = style;

  return (
    <article className="style-detail-panel">
      <div className="style-detail-hero">
        <img alt={style.title} className="style-detail-image" src={style.imageUrl} />
        <div className="style-detail-summary">
          <h1>{style.title}</h1>
        </div>
      </div>

      <div className="analyze-summary-bar">
        <div className="analyze-summary-item">
          <span className="analyze-summary-label">参考总价</span>
          <span className="analyze-summary-value">
            {previewQuote.price > 0 ? `${previewQuote.price.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="analyze-summary-divider" />
        <div className="analyze-summary-item">
          <span className="analyze-summary-label">参考时长</span>
          <span className="analyze-summary-value">
            {previewQuote.duration > 0 ? `${previewQuote.duration} 分钟` : '—'}
          </span>
        </div>
      </div>

      <div className="detail-actions">
        <Link className="button button-primary button-block" href={`${getCustomerBookingPath()}?styleId=${style.id}`}>
          Book this look
        </Link>
        <Link className="button button-ghost button-block" href={getCustomerTryOnPath(style.id)}>
          Try on this look
        </Link>
      </div>
    </article>
  );
}

