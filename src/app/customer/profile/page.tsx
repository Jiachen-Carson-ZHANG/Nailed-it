'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { BookingHistoryCard } from '@/features/customer/BookingHistoryCard';
import { demoCustomerName, getBookingsSnapshot } from '@/mock/operations-store';

export default function CustomerProfilePage() {
  const [bookings] = useState(() => getBookingsSnapshot());
  const customerBookings = bookings.filter((booking) => booking.customerName === demoCustomerName);
  // 中文注释：这里按"仍会占用用户心智"的状态聚合 upcoming，后续接真实后端也能复用同一口径。
  const upcomingBookings = customerBookings.filter((booking) =>
    ['pending_review', 'confirmed'].includes(booking.status)
  );

  return (
    <MobileLayout
      role="customer"
      title="Nailed-it"
    >
      <section className="profile-identity" aria-label="Customer identity">
        <div className="profile-identity-avatar" aria-hidden="true">
          {demoCustomerName.charAt(0)}
        </div>
        <div className="profile-identity-meta">
          <h1>{demoCustomerName}</h1>
          <p>{customerBookings.length} bookings · joined 2026</p>
        </div>
      </section>

      <section className="profile-stat-grid" aria-label="Customer profile stats">
        <article className="summary-card stat-card">
          <span className="profile-stat-label">Upcoming bookings</span>
          <strong>{upcomingBookings.length}</strong>
        </article>
        <article className="summary-card stat-card">
          <span className="profile-stat-label">Saved notes</span>
          <strong>{customerBookings.length}</strong>
        </article>
      </section>

      <section className="profile-section">
        <h2>Booking history</h2>
        <div className="history-list">
          {customerBookings.map((booking) => (
            <BookingHistoryCard key={booking.id} booking={booking} />
          ))}
        </div>
      </section>

      <Link className="button button-secondary button-block" href="/privacy">
        Privacy Policy
      </Link>
    </MobileLayout>
  );
}
