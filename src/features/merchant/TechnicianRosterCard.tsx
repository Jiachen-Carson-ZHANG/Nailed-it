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
      <ul className="technician-roster">
        {technicians.map((technician) => {
          const activeBookingCount = workloadByTechnician[technician.id] ?? 0;
          const activeBookingLabel =
            activeBookingCount === 1 ? '1 active booking' : `${activeBookingCount} active bookings`;

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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
