import Link from 'next/link';
import type { Booking, Technician } from '@/domain/nail';
import { getMerchantBookingPath } from '@/domain/session';

type TechnicianRosterCardProps = {
  bookings: Booking[];
  description?: string;
  technicians: Technician[];
  title: string;
};

const activeBookingStatuses = new Set<Booking['status']>(['confirmed', 'pending_review']);

const statusLabels: Record<Booking['status'], string> = {
  pending_review: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// Group a technician's bookings by date so a long horizon collapses into one row per day instead of
// a flat wall of chips. Days and the bookings inside them are sorted chronologically.
function groupByDay(bookings: Booking[]): { date: string; items: Booking[] }[] {
  const byDate = new Map<string, Booking[]>();
  for (const booking of bookings) {
    const existing = byDate.get(booking.date);
    if (existing) existing.push(booking);
    else byDate.set(booking.date, [booking]);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items: items.sort((x, y) => x.time.localeCompare(y.time)) }));
}

export function TechnicianRosterCard({
  bookings,
  description,
  technicians,
  title
}: TechnicianRosterCardProps) {
  const bookingsByTechnician = bookings.reduce<Record<string, Booking[]>>((acc, booking) => {
    if (!activeBookingStatuses.has(booking.status)) return acc;
    const id = booking.technician.id;
    (acc[id] ??= []).push(booking);
    return acc;
  }, {});

  return (
    <section className="summary-card" aria-label={title}>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      <ul className="technician-roster">
        {technicians.map((technician) => {
          const activeBookings = bookingsByTechnician[technician.id] ?? [];
          const days = groupByDay(activeBookings);
          const activeBookingLabel =
            activeBookings.length === 1 ? '1 active booking' : `${activeBookings.length} active bookings`;

          return (
            <li key={technician.id} className="technician-roster-row">
              <div className="technician-roster-primary">
                <strong>{technician.name}</strong>
                <span>{technician.title}</span>
              </div>
              <div className="technician-roster-meta">
                <span
                  className={
                    technician.active
                      ? 'technician-status-badge technician-status-active'
                      : 'technician-status-badge'
                  }
                >
                  {technician.active ? 'Active' : 'Inactive'}
                </span>
                <span className="technician-roster-bookings">{activeBookingLabel}</span>
              </div>
              {days.length > 0 && (
                <div className="workload-days">
                  {days.map((day, index) => (
                    // First (soonest) day open by default; the rest collapse to keep a long horizon tidy.
                    <details className="workload-day" key={day.date} open={index === 0}>
                      <summary className="workload-day-summary">
                        <span className="workload-day-date">{day.date}</span>
                        <span className="workload-day-count">{day.items.length}</span>
                      </summary>
                      <div className="workload-day-list">
                        {day.items.map((booking) => (
                          <details className="workload-booking" key={booking.id}>
                            <summary className="workload-booking-summary">
                              <span className="workload-booking-time">{booking.time}</span>
                              <span className="workload-booking-title">{booking.styleTitle}</span>
                              <span className={`workload-status workload-status-${booking.status}`}>
                                {statusLabels[booking.status]}
                              </span>
                            </summary>
                            <dl className="workload-booking-facts">
                              <div><dt>Customer</dt><dd>{booking.customerName}</dd></div>
                              <div><dt>Quote</dt><dd>SGD {booking.quote.price} · {booking.quote.duration} min</dd></div>
                              {booking.notes ? <div><dt>Notes</dt><dd>{booking.notes}</dd></div> : null}
                            </dl>
                            <Link className="workload-booking-link" href={getMerchantBookingPath(booking.id)}>
                              Open booking →
                            </Link>
                          </details>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
