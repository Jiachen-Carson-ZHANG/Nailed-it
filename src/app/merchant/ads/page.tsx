'use client';

import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { StyleAdCenter } from '@/features/merchant/StyleAdCenter';
import { getMerchantProfilePath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';

const adCenterPageCopy = {
  'zh-CN': {
    title: '广告中心',
    back: '返回个人资料',
    body: '查看各款式的推广状态与投放表现。',
  },
  en: {
    title: 'Ad center',
    back: 'Back to profile',
    body: 'Track promotion status and performance across your designs.',
  },
} as const;

export default function MerchantAdCenterPage() {
  const { language } = useLanguage();
  const copy = adCenterPageCopy[language];

  return (
    <MobileLayout role="merchant" title={copy.title}>
      <section className="page-heading">
        <Link className="merchant-review-back" href={getMerchantProfilePath()}>{copy.back}</Link>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
      </section>
      <StyleAdCenter />
    </MobileLayout>
  );
}
