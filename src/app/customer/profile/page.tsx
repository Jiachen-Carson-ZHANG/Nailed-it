'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getCustomerBookingPath } from '@/domain/session';
import { BookingHistoryCard } from '@/features/customer/BookingHistoryCard';
import { demoCustomerName, getBookingsSnapshot } from '@/mock/operations-store';

export default function CustomerProfilePage() {
  const [bookings] = useState(() => getBookingsSnapshot());
  const customerBookings = bookings.filter((booking) => booking.customerName === demoCustomerName);
  // 中文注释：这里按“仍会占用用户心智”的状态聚合 upcoming，后续接真实后端也能复用同一口径。
  const upcomingBookings = customerBookings.filter((booking) =>
    ['pending_review', 'confirmed'].includes(booking.status)
  );

  return (
    <MobileLayout
      role="customer"
      title="Nailed-it"
    >
      <section className="profile-hero">
        <p className="section-eyebrow">Your profile</p>
        <h1>{demoCustomerName}</h1>
        <p className="section-copy">Keep track of upcoming visits, design notes, and your latest booking context.</p>
        <Link className="button button-primary button-block" href={getCustomerBookingPath()}>
          Start a new booking
        </Link>
      </section>

      <section className="profile-stat-grid" aria-label="Customer profile stats">
        <article className="summary-card">
          <span className="profile-stat-label">Upcoming bookings</span>
          <strong>{upcomingBookings.length}</strong>
          <p>Active requests and confirmed appointments still on your calendar.</p>
        </article>
        <article className="summary-card">
          <span className="profile-stat-label">Saved notes</span>
          <strong>{customerBookings.length}</strong>
          <p>Booking snapshots retain the notes you used to brief the merchant.</p>
        </article>
      </section>

      <section className="profile-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Booking history</p>
            <h2>Recent appointments</h2>
          </div>
        </div>
        <div className="history-list">
          {customerBookings.map((booking) => (
            <BookingHistoryCard key={booking.id} booking={booking} />
          ))}
        </div>
      </section>

      <section className="summary-card">
        <strong>Privacy and connected accounts</strong>
        <p>Review how optional Pinterest access and reference images are handled in this MVP.</p>
        <Link className="button button-secondary button-block" href="/privacy">
          Privacy Policy
        </Link>
      </section>

    </MobileLayout>
  );
}
