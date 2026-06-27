'use client';

import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { MerchantStyleLibrary } from '@/features/merchant/MerchantStyleLibrary';
import { AgentActionInline } from '@/features/merchant/AgentActionInline';
import { getMerchantProfilePath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';

const stylesPageCopy = {
  'zh-CN': {
    title: '款式库',
    back: '返回个人资料',
    body: '上传、审核并发布款式，供顾客浏览与预约。',
  },
  en: {
    title: 'Style library',
    back: 'Back to profile',
    body: 'Upload, review, and publish designs for customers to discover.',
  },
} as const;

export default function MerchantStylesPage() {
  const { language } = useLanguage();
  const copy = stylesPageCopy[language];

  return (
    <MobileLayout role="merchant" title={copy.title}>
      <section className="page-heading">
        <Link className="merchant-review-back" href={getMerchantProfilePath()}>{copy.back}</Link>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
      </section>
      <AgentActionInline types={['place_ad']} />
      <MerchantStyleLibrary />
    </MobileLayout>
  );
}
