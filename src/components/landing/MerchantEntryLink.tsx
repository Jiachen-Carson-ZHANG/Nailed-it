'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import { queueMerchantEntryHint } from '@/lib/merchant-entry-hint';
import { landingRoutes } from './landing-content';

type MerchantEntryLinkProps = {
  children: ReactNode;
  className: string;
};

export function MerchantEntryLink({ children, className }: MerchantEntryLinkProps) {
  return (
    <Link href={landingRoutes.merchant} className={className} onClick={queueMerchantEntryHint}>
      {children}
    </Link>
  );
}
