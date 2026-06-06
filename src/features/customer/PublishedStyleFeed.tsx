'use client';

import { useEffect, useState } from 'react';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';
import { listCustomerPublishedStylesAction } from '@/lib/actions/merchant-style-actions';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StyleWaterfallGridClient } from './StyleWaterfallGridClient';

export function PublishedStyleFeed() {
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
    return <EmptyState title="Styles unavailable" body="Please refresh to load the latest designs." />;
  }
  if (styles === null) {
    return <LoadingState title="Loading merchant styles" body="Fetching the latest published designs." />;
  }
  return <StyleWaterfallGridClient styles={styles} />;
}
