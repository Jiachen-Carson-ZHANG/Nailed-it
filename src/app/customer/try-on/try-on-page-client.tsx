'use client';

import { useRouter } from 'next/navigation';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { TryOnPanel } from '@/features/customer/TryOnPanel';
import { useLanguage } from '@/i18n/context';

type TryOnPageClientProps = {
  prefillStyleImageUrl?: string;
  styleId?: string;
  from?: string;
};

export function TryOnPageClient({ prefillStyleImageUrl, styleId, from }: TryOnPageClientProps) {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <MobileLayout role="customer" title={t('tryOn.page.title')}>
      <section className="page-heading">
        <button type="button" className="detail-back-link detail-back-top" onClick={() => router.back()}>
          {t('tryOn.back')}
        </button>
        <h1>{t('tryOn.page.title')}</h1>
      </section>
      <TryOnPanel prefillStyleImageUrl={prefillStyleImageUrl} styleId={styleId} from={from} />
    </MobileLayout>
  );
}
