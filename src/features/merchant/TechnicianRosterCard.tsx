import type { Booking, Technician } from '@/domain/nail';

type TechnicianRosterCardProps = {
  bookings: Booking[];
  description: string;
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
  const workloadByTechnician = bookings.reduce<Record<string, number>>((workload, booking) => {
    if (!activeBookingStatuses.has(booking.status)) {
      return workload;
    }

    return {
      ...workload,
      [booking.technician.id]: (workload[booking.technician.id] ?? 0) + 1
    };
  }, {});

  return (
    <section className="summary-card" aria-label={title}>
      <strong>{title}</strong>
      <p>{description}</p>
      <div className="booking-list">
        {technicians.map((technician) => {
          const activeBookingCount = workloadByTechnician[technician.id] ?? 0;
          const activeBookingLabel =
            activeBookingCount === 1 ? '1 active booking' : `${activeBookingCount} active bookings`;

          return (
            <p key={technician.id}>
              {technician.name} · {technician.title} ·{' '}
              {technician.active ? 'Active' : 'Inactive'} · {activeBookingLabel}
            </p>
          );
        })}
      </div>
    </section>
  );
}
