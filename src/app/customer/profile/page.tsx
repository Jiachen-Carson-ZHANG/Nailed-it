import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getCustomerBookingPath } from '@/domain/session';
import { BookingHistoryCard } from '@/features/customer/BookingHistoryCard';
import { mockBookings } from '@/mock/bookings';

const customerName = 'Melissa Tan';

export default function CustomerProfilePage() {
  const customerBookings = mockBookings.filter((booking) => booking.customerName === customerName);
  // 中文注释：这里按“仍会占用用户心智”的状态聚合 upcoming，后续接真实后端也能复用同一口径。
  const upcomingBookings = customerBookings.filter((booking) =>
    ['pending', 'confirmed', 'in_progress'].includes(booking.status)
  );

  return (
    <MobileLayout
      role="customer"
      subtitle="Customer profile reads booking continuity from the shared booking snapshots."
      title="Nailed-it"
    >
      <section className="profile-hero">
        <p className="section-eyebrow">Customer profile</p>
        <h1>{customerName}</h1>
        <p className="section-copy">Keep track of upcoming visits, design notes, and your latest booking context.</p>
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

      <Link className="button" href={getCustomerBookingPath()}>
        Start a new booking
      </Link>
    </MobileLayout>
  );
}
