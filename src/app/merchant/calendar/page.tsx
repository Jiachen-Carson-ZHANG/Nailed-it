'use client';

import { useEffect, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Toast } from '@/components/ui/Toast';
import { TodayHome } from '@/features/merchant/TodayHome';
import { useLanguage } from '@/i18n/context';
import { consumeMerchantEntryHint } from '@/lib/merchant-entry-hint';

// Merchant tab 1 = the 今日 agent-ops home (DESIGN.md → "Merchant Agent Home"). Route reused to avoid
// tab/home-path churn (audit 2026-07-06); the full calendar moved to /merchant/calendar/schedule.

const merchantEntryHintCopy = {
  'zh-CN': '欢迎入驻！新手商家请先前往下方管理页面设置并保存价目表哦～',
  en: 'Welcome aboard! New merchants should set up and save the pricing menu from the management page below first.'
} as const;

export default function MerchantHomePage() {
  const { language } = useLanguage();
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    // 只在通过 landing 商家入口首次进入时提示一次，避免后续重复打扰。
    if (consumeMerchantEntryHint()) {
      setToastMessage(merchantEntryHintCopy[language]);
    }
  }, [language]);

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <TodayHome />
      <Toast message={toastMessage} />
    </MobileLayout>
  );
}
