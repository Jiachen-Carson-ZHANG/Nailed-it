'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { pickLocalizedText } from '@/i18n/localized';
import { useLanguage } from '@/i18n/context';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';
import type { BreakdownResult } from '@/domain/nail';
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
  const imageUrl = style.imageUrl.trim();

  const cachedResult = useMemo(
    () => buildBreakdownFromConfig(style.catalogBreakdown, style.discoveryFacets.map((f) => f.label)),
    [style.catalogBreakdown, style.discoveryFacets],
  );

  const [liveBreakdown, setLiveBreakdown] = useState<BreakdownResult>(cachedResult);

  const bookingUrl = `${getCustomerBookingPath()}?styleId=${style.id}&livePrice=${Math.round(liveBreakdown.totalPrice * 100)}&liveDuration=${liveBreakdown.totalDuration}`;

  const footer = (
    <div className="detail-actions" style={{ marginTop: '1rem' }}>
      <Link className="button button-primary button-block" href={bookingUrl}>
        {t('style.detail.book')}
      </Link>
      <Link className="button button-secondary button-block" href={`${getCustomerTryOnPath(style.id)}&imageUrl=${encodeURIComponent(imageUrl)}`}>
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
        {imageUrl ? <img alt={title} className="style-detail-image" src={imageUrl} /> : null}
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
        onResult={setLiveBreakdown}
        footer={footer}
      />
    </article>
  );
}
