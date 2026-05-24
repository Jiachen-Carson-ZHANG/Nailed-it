import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getMerchantManagePath } from '@/domain/session';
import { MonthlyCalendar } from '@/features/merchant/MonthlyCalendar';
import { mockBookings } from '@/mock/bookings';

export default function MerchantCalendarPage() {
  const todayCount = mockBookings.filter((booking) => booking.date === '2026-05-23').length;

  return (
    <MobileLayout
      role="merchant"
      subtitle="Monthly calendar, day sheet, and booking details all read from the shared mock booking snapshots."
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">May 2026</p>
        <h1>Appointment calendar</h1>
        <p className="section-copy">Tap a day to inspect the appointment sheet for that date.</p>
      </section>
      <section className="summary-card">
        <strong>{todayCount} bookings on today&apos;s board</strong>
        <p>Use the calendar to inspect daily workload, then switch to manage when pricing rules need tuning.</p>
        <Link className="button button-secondary" href={getMerchantManagePath()}>
          Open pricing rules
        </Link>
      </section>
      <MonthlyCalendar bookings={mockBookings} />
    </MobileLayout>
  );
}
