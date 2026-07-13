'use client';

import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { StyleAdEditor } from '@/features/merchant/StyleAdEditor';
import { useLanguage } from '@/i18n/context';

const adEditorPageCopy = {
  'zh-CN': {
    title: '款式推广',
    back: '返回款式库',
    body: '为这款美甲设置推广计划。',
  },
  en: {
    title: 'Style promotion',
    back: 'Back to style library',
    body: 'Set up a promotion plan for this design.',
  },
} as const;

export function StyleAdEditorPageClient({ styleId }: { styleId: string }) {
  const { language } = useLanguage();
  const copy = adEditorPageCopy[language];

  return (
    <MobileLayout brandHref="/merchant/styles" role="merchant" title={copy.title}>
      <section className="page-heading">
        <Link className="merchant-review-back" href="/merchant/styles">{copy.back}</Link>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
      </section>
      <StyleAdEditor styleId={styleId} />
    </MobileLayout>
  );
}
