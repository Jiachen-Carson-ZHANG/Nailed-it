'use client';

import { useEffect, useState } from 'react';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';
import { listCustomerPublishedStylesAction } from '@/lib/actions/merchant-style-actions';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useLanguage } from '@/i18n/context';
import { StyleWaterfallGridClient } from './StyleWaterfallGridClient';

export function PublishedStyleFeed() {
  const { t } = useLanguage();
  const [styles, setStyles] = useState<PublishedMerchantStyle[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    listCustomerPublishedStylesAction()
      .then((next) => {
        if (active) setStyles(next);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return <EmptyState title={t('home.feed.errorTitle')} body={t('home.feed.errorBody')} />;
  }
  if (styles === null) {
    return <LoadingState title={t('home.feed.loadingTitle')} body={t('home.feed.loadingBody')} />;
  }
  return <StyleWaterfallGridClient styles={styles} />;
}
