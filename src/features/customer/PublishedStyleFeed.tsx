'use client';

import { useEffect, useState } from 'react';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';
import { listCustomerPublishedStylesAction } from '@/lib/actions/merchant-style-actions';
import { getRankedFeedAction } from '@/lib/actions/customer-intel-actions';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useLanguage } from '@/i18n/context';
import { StyleWaterfallGridClient } from './StyleWaterfallGridClient';

type PublishedStyleFeedProps = {
  searchQuery: string;
};

export function PublishedStyleFeed({ searchQuery }: PublishedStyleFeedProps) {
  const { t } = useLanguage();
  const [styles, setStyles] = useState<PublishedMerchantStyle[] | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getRankedFeedAction()
      .then((feed) => {
        if (!active) return;
        setStyles(feed.styles);
        setReasons(feed.reasons);
      })
      .catch(() =>
        listCustomerPublishedStylesAction()
          .then((next) => active && setStyles(next))
          .catch(() => active && setFailed(true)),
      );
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return <EmptyState title={t('feed.unavailableTitle')} body={t('feed.unavailableBody')} />;
  }
  if (styles === null) {
    return <LoadingState title={t('feed.loadingTitle')} body={t('feed.loadingBody')} />;
  }
  return <StyleWaterfallGridClient styles={styles} reasonByStyleId={reasons} searchQuery={searchQuery} />;
}
