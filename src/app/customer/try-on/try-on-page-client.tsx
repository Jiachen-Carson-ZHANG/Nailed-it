'use client';

import { MobileLayout } from '@/components/layout/MobileLayout';
import { TryOnPanel } from '@/features/customer/TryOnPanel';
import { useLanguage } from '@/i18n/context';

type TryOnPageClientProps = {
  prefillStyleImageUrl?: string;
  styleId?: string;
};

export function TryOnPageClient({ prefillStyleImageUrl, styleId }: TryOnPageClientProps) {
  const { t } = useLanguage();

  return (
    <MobileLayout role="customer" title={t('tryOn.page.title')}>
      <section className="page-heading">
        <p className="section-eyebrow">{t('tryOn.page.eyebrow')}</p>
        <h1>{t('tryOn.page.title')}</h1>
        <p className="helper-copy">{t('tryOn.page.helper')}</p>
      </section>
      <TryOnPanel prefillStyleImageUrl={prefillStyleImageUrl} styleId={styleId} />
    </MobileLayout>
  );
}
