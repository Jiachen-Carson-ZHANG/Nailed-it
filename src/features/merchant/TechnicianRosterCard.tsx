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
              {activeBookings.length > 0 && (
                <ul className="technician-booking-links">
                  {activeBookings.map((booking) => (
                    <li key={booking.id}>
                      <Link href={getMerchantBookingPath(booking.id)} className="technician-booking-link">
                        {booking.styleTitle} · {booking.date} {booking.time}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
