import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getMerchantManagePath } from '@/domain/session';
import { MerchantAnalyticsCard } from '@/features/merchant/MerchantAnalyticsCard';
import { mockBookings } from '@/mock/bookings';
import { merchantConversations } from '@/mock/conversations';

export default function MerchantProfilePage() {
  // 中文注释：merchant profile 只做运营摘要，不复制 calendar 里的排班细节，避免第二套调度状态源。
  const pendingBookings = mockBookings.filter((booking) =>
    ['pending', 'confirmed', 'in_progress'].includes(booking.status)
  );
  const unreadThreads = merchantConversations.filter((conversation) => conversation.unreadCount > 0);

  return (
    <MobileLayout
      role="merchant"
      subtitle="Merchant profile summarizes current workload, inbound demand, and links back to pricing operations."
      title="Nailed-it"
    >
      <section className="profile-hero">
        <p className="section-eyebrow">Merchant profile</p>
        <h1>Studio profile</h1>
        <p className="section-copy">Use this view as a quick operating pulse before switching back into calendar or pricing work.</p>
      </section>

      <section className="analytics-grid" aria-label="Merchant analytics">
        <MerchantAnalyticsCard
          detail="All shared booking snapshots currently represented in the merchant workspace."
          title="Appointments this week"
          value={String(mockBookings.length)}
        />
        <MerchantAnalyticsCard
          detail="Threads that likely need a reply before the next appointment window shifts."
          title="Unread conversations"
          value={String(unreadThreads.length)}
        />
        <MerchantAnalyticsCard
          detail="Pending or confirmed work that still consumes near-term capacity."
          title="Open bookings"
          value={String(pendingBookings.length)}
        />
      </section>

      <section className="summary-card">
        <strong>Pricing and bookings stay connected through one mock operating model</strong>
        <p>Adjust estimate rules only from the management surface so customer quotes and merchant expectations remain aligned.</p>
      </section>

      <Link className="button" href={getMerchantManagePath()}>
        Open pricing rules
      </Link>
    </MobileLayout>
  );
}
