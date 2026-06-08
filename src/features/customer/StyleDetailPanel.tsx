'use client';

import Link from 'next/link';
import { pickLocalizedText } from '@/i18n/localized';
import { useLanguage } from '@/i18n/context';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';
import { getCustomerBookingPath, getCustomerTryOnPath } from '@/domain/session';
import { demoCustomerId } from '@/mock/customers';
import { TrackOnMount } from '@/features/analytics/TrackOnMount';
import { ComponentBreakdownPanel, buildBreakdownFromConfig } from '@/features/customer/ComponentBreakdownPanel';

type StyleDetailPanelProps = {
  backHref: string;
  style: PublishedMerchantStyle;
};

export function StyleDetailPanel({ backHref, style }: StyleDetailPanelProps) {
  const { language, t } = useLanguage();
  const title = style.titleLocalized ? pickLocalizedText(style.titleLocalized, language) : style.title;

  const facetLabels = style.discoveryFacets.map((f) => f.label);
  const cachedResult = buildBreakdownFromConfig(style.catalogBreakdown, facetLabels);

  const footer = (
    <div className="detail-actions" style={{ marginTop: '1rem' }}>
      <Link className="button button-primary button-block" href={`${getCustomerBookingPath()}?styleId=${style.id}`}>
        {t('style.detail.book')}
      </Link>
      <Link className="button button-secondary button-block" href={getCustomerTryOnPath(style.id)}>
        {t('style.detail.tryOn')}
      </Link>
    </div>
  );

  return (
    <article className="style-detail-panel">
      <TrackOnMount
        eventType="style_detail_view"
        styleId={style.id}
        customerId={demoCustomerId}
        eventSource="style_detail"
      />
      <Link className="detail-back-link detail-back-top" href={backHref}>← {t('style.detail.back')}</Link>
      <div className="style-detail-hero">
        <img alt={title} className="style-detail-image" src={style.imageUrl} />
        <div className="style-detail-summary">
          <h1>{title}</h1>
        </div>
      </div>

      <ComponentBreakdownPanel
        image={null}
        previewUrl={undefined}
        cachedResult={cachedResult}
        showRemoval={false}
        autoAnalyze={false}
        showReanalyze={false}
        footer={footer}
      />
    </article>
  );
}
