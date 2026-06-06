'use client';

import { useEffect, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { LoadingState } from '@/components/ui/LoadingState';
import { CalendarSchedule } from '@/features/merchant/CalendarSchedule';
import type { Booking } from '@/domain/nail';
import { listMerchantBookingViewsAction } from '@/lib/actions/booking-actions';

export default function MerchantCalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

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
      {loading ? (
        <LoadingState title="Loading appointments" body="Fetching the latest schedule from the booking service." />
      ) : (
        <CalendarSchedule bookings={bookings} />
      )}
    </MobileLayout>
  );
}
