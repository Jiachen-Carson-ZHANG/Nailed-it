import Link from 'next/link';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';
import { getCustomerBookingPath, getCustomerTryOnPath } from '@/domain/session';

type StyleDetailPanelProps = {
  style: PublishedMerchantStyle;
};

export function StyleDetailPanel({ style }: StyleDetailPanelProps) {

  return (
    <article className="style-detail-panel">
      <div className="style-detail-hero">
        <img alt={style.title} className="style-detail-image" src={style.imageUrl} />
      </div>

      <h1 className="style-detail-title">{style.title}</h1>

      <div className="analyze-summary-bar">
        <div className="analyze-summary-item">
          <span className="analyze-summary-label">参考总价</span>
          <span className="analyze-summary-value">
            {style.previewQuote.price > 0 ? `$${style.previewQuote.price.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="analyze-summary-divider" />
        <div className="analyze-summary-item">
          <span className="analyze-summary-label">参考时长</span>
          <span className="analyze-summary-value">
            {style.previewQuote.duration > 0 ? `${style.previewQuote.duration} 分钟` : '—'}
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
