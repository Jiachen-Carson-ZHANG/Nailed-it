'use client';

import { MobileLayout } from '@/components/layout/MobileLayout';
import { MerchantStyleEditor } from '@/features/merchant/MerchantStyleEditor';
import { useLanguage } from '@/i18n/context';

const reviewPageCopy = {
  'zh-CN': {
    subtitle: '确认 AI 拆解结果后，保存或发布款式。',
  },
  en: {
    subtitle: 'Review the AI breakdown, then save or publish.',
  },
} as const;

export function MerchantStyleReviewPageClient({ styleId }: { styleId: string }) {
  const { language } = useLanguage();
  const copy = reviewPageCopy[language];

  return (
    <MobileLayout
      brandHref="/merchant/styles"
      role="merchant"
      showTabs={false}
      subtitle={copy.subtitle}
    >
      <MerchantStyleEditor styleId={styleId} />
    </MobileLayout>
  );
}
