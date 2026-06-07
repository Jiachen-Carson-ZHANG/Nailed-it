'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { LanguageSwitcher } from '@/features/shared/LanguageSwitcher';
import type { Booking, Conversation } from '@/domain/nail';
import { getMerchantManagePath, homePathForRole } from '@/domain/session';
import { MerchantAnalyticsCard } from '@/features/merchant/MerchantAnalyticsCard';
import { MerchantStylePreview } from '@/features/merchant/MerchantStylePreview';
import { TechnicianRosterCard } from '@/features/merchant/TechnicianRosterCard';
import { useLanguage } from '@/i18n/context';
import { listMerchantBookingViewsAction } from '@/lib/actions/booking-actions';
import { listMerchantConversationsAction } from '@/lib/actions/conversation-actions';
import { mockTechnicians } from '@/mock/technicians';

const merchantProfileCopy = {
  'zh-CN': {
    analyticsLabel: '商家数据',
    appointmentsThisWeek: '本周预约',
    appointmentsThisWeekDetail: '本周所有技师的活跃预约数量。',
    openBookings: '进行中的预约',
    openBookingsDetail: '当前排期里仍在推进的预约。',
    openPricingRules: '打开定价规则',
    privacyPolicy: '隐私政策',
    studioProfile: '门店资料',
    switchToCustomerView: '切换到顾客视图 ↗',
    technicianWorkload: '技师工作负载',
    unreadConversations: '未读对话',
    unreadConversationsDetail: '仍在等待你回复的顾客消息。',
    workspaceCopy: '先在这里快速查看经营脉搏，再切回日历或价格配置继续处理。',
    workspaceEyebrow: '你的工作台',
  },
  en: {
    analyticsLabel: 'Merchant analytics',
    appointmentsThisWeek: 'Appointments this week',
    appointmentsThisWeekDetail: 'Bookings active this week across all technicians.',
    openBookings: 'Open bookings',
    openBookingsDetail: 'Active appointments on your schedule.',
    openPricingRules: 'Open pricing rules',
    privacyPolicy: 'Privacy Policy',
    studioProfile: 'Studio profile',
    switchToCustomerView: 'Switch to customer view ↗',
    technicianWorkload: 'Technician workload',
    unreadConversations: 'Unread conversations',
    unreadConversationsDetail: 'Conversations waiting for your reply.',
    workspaceCopy: 'Use this view as a quick operating pulse before switching back into calendar or pricing work.',
    workspaceEyebrow: 'Your workspace',
  },
} as const;

function MerchantProfileContent() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { language } = useLanguage();
  const copy = merchantProfileCopy[language];

  useEffect(() => {
    let active = true;
    Promise.all([listMerchantBookingViewsAction(), listMerchantConversationsAction()])
      .then(([b, c]) => {
        if (active) {
          setBookings(b);
          setConversations(c);
        }
      })
      .catch(() => {
        /* leave empty */
      });
    return () => {
      active = false;
    };
  }, []);

  const pendingBookings = bookings.filter((booking) =>
    ['pending_review', 'confirmed'].includes(booking.status)
  );
  const unreadThreads = conversations.filter((conversation) => conversation.unreadCount > 0);

  return (
    <MobileLayout
      role="merchant"
      title="Nailed-it"
    >
      <section className="profile-hero">
        <p className="section-eyebrow">{copy.workspaceEyebrow}</p>
        <h1>{copy.studioProfile}</h1>
        <p className="section-copy">{copy.workspaceCopy}</p>
      </section>

      <section className="analytics-grid" aria-label={copy.analyticsLabel}>
        <MerchantAnalyticsCard
          detail={copy.appointmentsThisWeekDetail}
          title={copy.appointmentsThisWeek}
          value={String(bookings.length)}
        />
        <MerchantAnalyticsCard
          detail={copy.unreadConversationsDetail}
          title={copy.unreadConversations}
          value={String(unreadThreads.length)}
        />
        <MerchantAnalyticsCard
          detail={copy.openBookingsDetail}
          title={copy.openBookings}
          value={String(pendingBookings.length)}
        />
      </section>

      <TechnicianRosterCard
        bookings={bookings}
        technicians={mockTechnicians}
        title={copy.technicianWorkload}
      />

      <MerchantStylePreview />

      <Link className="button button-primary button-block" href={getMerchantManagePath()}>
        {copy.openPricingRules}
      </Link>

      <LanguageSwitcher />

      <Link className="button button-secondary button-block" href="/privacy">
        {copy.privacyPolicy}
      </Link>

      <Link className="button button-secondary button-block" href={homePathForRole('customer')}>
        {copy.switchToCustomerView}
      </Link>
    </MobileLayout>
  );
}

export default function MerchantProfilePage() {
  return <MerchantProfileContent />;
}
