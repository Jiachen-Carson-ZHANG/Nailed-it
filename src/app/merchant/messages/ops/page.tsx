'use client';

import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getMerchantMessagesPath } from '@/domain/session';
import { OpsBotThread } from '@/features/merchant/OpsBotThread';
import { useLanguage } from '@/i18n/context';

export default function MerchantOpsBotPage() {
  const { t } = useLanguage();

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <section className="page-heading opsbot-header">
        <span className="opsbot-avatar" aria-hidden>AI</span>
        <div>
          <h1>{t('messages.merchant.opsTitle')}</h1>
          <p className="section-copy">{t('messages.merchant.opsPageBody')}</p>
        </div>
      </section>

      <OpsBotThread />

      <Link className="button button-secondary button-block" href={getMerchantMessagesPath()}>
        {t('messages.merchant.opsBack')}
      </Link>
    </MobileLayout>
  );
}
