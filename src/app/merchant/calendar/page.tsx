'use client';

import { useEffect, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { LoadingState } from '@/components/ui/LoadingState';
import { Toast } from '@/components/ui/Toast';
import { CalendarSchedule } from '@/features/merchant/CalendarSchedule';
import type { Booking } from '@/domain/nail';
import { useLanguage } from '@/i18n/context';
import { listMerchantBookingViewsAction } from '@/lib/actions/booking-actions';
import { consumeMerchantEntryHint } from '@/lib/merchant-entry-hint';

const calendarPageCopy = {
  'zh-CN': {
    eyebrow: '日历',
    title: '预约日历',
    loadingTitle: '正在加载预约',
    loadingBody: '正在获取最新排期。',
  },
  en: {
    eyebrow: 'Calendar',
    title: 'Appointment calendar',
    loadingTitle: 'Loading appointments',
    loadingBody: 'Fetching the latest schedule from the booking service.',
  },
} as const;

const merchantEntryHintCopy = {
  'zh-CN': '欢迎入驻！新手商家请先前往下方管理页面设置并保存价目表哦～',
  en: 'Welcome aboard! New merchants should set up and save the pricing menu from the management page below first.'
} as const;

export default function MerchantCalendarPage() {
  const { language } = useLanguage();
  const copy = calendarPageCopy[language];
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    let active = true;
    listMerchantBookingViewsAction()
      .then((rows) => {
        if (active) setBookings(rows);
      })
      .catch(() => {
        /* leave empty; the calendar stays usable */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // 只在通过 landing 商家入口首次进入时提示一次，避免后续重复打扰。
    if (consumeMerchantEntryHint()) {
      setToastMessage(merchantEntryHintCopy[language]);
    }
  }, [language]);

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <section className="page-heading">
        <p className="section-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
      </section>
      {loading ? (
        <LoadingState title={copy.loadingTitle} body={copy.loadingBody} />
      ) : (
        <CalendarSchedule bookings={bookings} />
      )}
      <Toast message={toastMessage} />
    </MobileLayout>
  );
}
