'use client';

import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { MonthlyCalendar } from '@/features/merchant/MonthlyCalendar';
import { getBookingsSnapshot } from '@/mock/operations-store';

export default function MerchantCalendarPage() {
  const [bookings] = useState(() => getBookingsSnapshot());

  return (
    <MobileLayout
      role="merchant"
      subtitle="Your daily schedule."
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">May 2026</p>
        <h1>Appointment calendar</h1>
      </section>
      <MonthlyCalendar bookings={bookings} />
    </MobileLayout>
  );
}
