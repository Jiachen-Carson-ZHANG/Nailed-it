'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { BookingHistoryCard } from '@/features/customer/BookingHistoryCard';
import type { Booking } from '@/domain/nail';
import { homePathForRole } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import { listCustomerBookingViewsAction, setBookingStatusAction } from '@/lib/actions/booking-actions';
import { demoCustomerName } from '@/mock/customers';

const customerProfileCopy = {
  'zh-CN': {
    bookingHistory: '预约历史',
    customerIdentity: '顾客资料',
    profileStats: '顾客统计',
    joinedIn: '2026 加入',
    savedNotes: '保存的备注',
    switchToMerchantView: '切换到商家视图 ↗',
    upcomingBookings: '即将到来的预约',
  },
  en: {
    bookingHistory: 'Booking history',
    customerIdentity: 'Customer identity',
    profileStats: 'Customer profile stats',
    joinedIn: 'joined 2026',
    savedNotes: 'Saved notes',
    switchToMerchantView: 'Switch to merchant view ↗',
    upcomingBookings: 'Upcoming bookings',
  },
} as const;

export default function CustomerProfilePage() {
  // Already filtered to the demo customer on the server (private bookings never reach the browser).
  const [customerBookings, setCustomerBookings] = useState<Booking[]>([]);
  const { language, t } = useLanguage();
  const copy = customerProfileCopy[language];

  const refresh = useCallback(async () => {
    setCustomerBookings(await listCustomerBookingViewsAction());
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      /* leave empty */
    });
  }, [refresh]);

  const withdrawBooking = useCallback(async (id: string) => {
    await setBookingStatusAction(id, 'cancelled');
    await refresh();
  }, [refresh]);
  // 中文注释：这里按"仍会占用用户心智"的状态聚合 upcoming，后续接真实后端也能复用同一口径。
  const upcomingBookings = customerBookings.filter((booking) =>
    ['pending_review', 'confirmed'].includes(booking.status)
  );
  const bookingSummary = `${customerBookings.length} ${language === 'zh-CN' ? '次预约' : 'bookings'} · ${copy.joinedIn}`;

  return (
    <MobileLayout
      role="customer"
      title="Nailed-it"
    >
      <section className="profile-identity" aria-label={copy.customerIdentity}>
        <div className="profile-identity-avatar" aria-hidden="true">
          {demoCustomerName.charAt(0)}
        </div>
        <div className="profile-identity-meta">
          <h1>{demoCustomerName}</h1>
          <p>{bookingSummary}</p>
        </div>
      </section>

      <section className="profile-stat-grid" aria-label={copy.profileStats}>
        <article className="summary-card stat-card">
          <span className="profile-stat-label">{copy.upcomingBookings}</span>
          <strong>{upcomingBookings.length}</strong>
        </article>
        <article className="summary-card stat-card">
          <span className="profile-stat-label">{copy.savedNotes}</span>
          <strong>{customerBookings.length}</strong>
        </article>
      </section>

      <section className="profile-section">
        <h2>{copy.bookingHistory}</h2>
        <div className="history-list">
          {customerBookings.map((booking) => (
            <BookingHistoryCard key={booking.id} booking={booking} onWithdraw={withdrawBooking} />
          ))}
        </div>
      </section>

      <Link className="button button-secondary button-block" href="/privacy">
        {t('common.privacyPolicy')}
      </Link>

      <Link className="button button-secondary button-block" href={homePathForRole('merchant')}>
        {copy.switchToMerchantView}
      </Link>
    </MobileLayout>
  );
}
