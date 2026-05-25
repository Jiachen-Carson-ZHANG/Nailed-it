'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getMerchantManagePath } from '@/domain/session';
import { MerchantAnalyticsCard } from '@/features/merchant/MerchantAnalyticsCard';
import { TechnicianRosterCard } from '@/features/merchant/TechnicianRosterCard';
import { getBookingsSnapshot, getConversationsForRole } from '@/mock/operations-store';
import { mockTechnicians } from '@/mock/technicians';

export default function MerchantProfilePage() {
  const [bookings] = useState(() => getBookingsSnapshot());
  const [conversations] = useState(() => getConversationsForRole('merchant'));
  const pendingBookings = bookings.filter((booking) =>
    ['pending_review', 'confirmed'].includes(booking.status)
  );
  const unreadThreads = conversations.filter((conversation) => conversation.unreadCount > 0);

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
          value={String(bookings.length)}
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

      <TechnicianRosterCard
        bookings={bookings}
        description="Current active workload by technician from confirmed and review-needed bookings."
        technicians={mockTechnicians}
        title="Technician workload"
      />

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
