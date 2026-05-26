'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getMerchantManagePath } from '@/domain/session';
import { MonthlyCalendar } from '@/features/merchant/MonthlyCalendar';
import { getBookingsSnapshot } from '@/mock/operations-store';

export default function MerchantCalendarPage() {
  const [bookings] = useState(() => getBookingsSnapshot());
  const todayCount = bookings.filter((booking) => booking.date === '2026-05-23').length;

  return (
    <MobileLayout
      role="merchant"
      subtitle="Your daily schedule."
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">May 2026</p>
        <h1>Appointment calendar</h1>
        <p className="section-copy">Tap a day to inspect the appointment sheet for that date.</p>
      </section>
      <section className="summary-card">
        <strong>{todayCount} bookings on today&apos;s board</strong>
        <p>Tap today on the calendar to see the sheet. Adjust pricing if a rule needs tuning.</p>
        <Link className="button button-ghost" href={getMerchantManagePath()}>
          Pricing rules
        </Link>
      </section>
      <MonthlyCalendar bookings={bookings} />
    </MobileLayout>
  );
}
