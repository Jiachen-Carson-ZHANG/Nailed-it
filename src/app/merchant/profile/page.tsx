'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import type { Booking, Conversation } from '@/domain/nail';
import { getMerchantManagePath, homePathForRole } from '@/domain/session';
import { MerchantAnalyticsCard } from '@/features/merchant/MerchantAnalyticsCard';
import { MerchantStylePreview } from '@/features/merchant/MerchantStylePreview';
import { TechnicianRosterCard } from '@/features/merchant/TechnicianRosterCard';
import { listMerchantBookingViewsAction } from '@/lib/actions/booking-actions';
import { listMerchantConversationsAction } from '@/lib/actions/conversation-actions';
import { mockTechnicians } from '@/mock/technicians';

export default function MerchantProfilePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);

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
        <p className="section-eyebrow">Your workspace</p>
        <h1>Studio profile</h1>
        <p className="section-copy">Use this view as a quick operating pulse before switching back into calendar or pricing work.</p>
      </section>

      <section className="analytics-grid" aria-label="Merchant analytics">
        <MerchantAnalyticsCard
          detail="Bookings active this week across all technicians."
          title="Appointments this week"
          value={String(bookings.length)}
        />
        <MerchantAnalyticsCard
          detail="Conversations waiting for your reply."
          title="Unread conversations"
          value={String(unreadThreads.length)}
        />
        <MerchantAnalyticsCard
          detail="Active appointments on your schedule."
          title="Open bookings"
          value={String(pendingBookings.length)}
        />
      </section>

      <TechnicianRosterCard
        bookings={bookings}
        technicians={mockTechnicians}
        title="Technician workload"
      />

      <MerchantStylePreview />

      <Link className="button button-primary button-block" href={getMerchantManagePath()}>
        Open pricing rules
      </Link>

      <Link className="button button-secondary button-block" href="/privacy">
        Privacy Policy
      </Link>

      <Link className="button button-secondary button-block" href={homePathForRole('customer')}>
        Switch to customer view ↗
      </Link>
    </MobileLayout>
  );
}
