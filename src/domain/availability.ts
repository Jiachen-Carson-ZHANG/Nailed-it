import type { Booking, Technician, TechnicianSlot } from './nail';

type FindTechnicianSlotsInput = {
  bookings: Booking[];
  days: Array<{
    date: string;
    label: string;
    slots: string[];
  }>;
  technicians: Technician[];
};

export type TechnicianSlotDay = {
  date: string;
  label: string;
  slots: TechnicianSlot[];
};

export function findTechnicianSlots({
  bookings,
  days,
  technicians
}: FindTechnicianSlotsInput): TechnicianSlotDay[] {
  const occupied = new Set(
    bookings
      .filter((booking) => booking.status !== 'cancelled')
      .map((booking) => slotKey(booking.date, booking.time, booking.technician.id))
  );
  const activeTechnicians = technicians.filter((technician) => technician.active);
  const sortedCandidates = days
    .flatMap((day) =>
      day.slots.flatMap((time) =>
        activeTechnicians.map<TechnicianSlot>((technician) => ({
          date: day.date,
          label: day.label,
          time,
          technician: {
            id: technician.id,
            name: technician.name,
            initials: technician.initials
          }
        }))
      )
    )
    .filter((slot) => !occupied.has(slotKey(slot.date, slot.time, slot.technician.id)))
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.time.localeCompare(right.time) ||
        left.technician.name.localeCompare(right.technician.name)
    )
    .map((slot, index) => ({
      ...slot,
      rankReason: index === 0 ? ('shortest_wait' as const) : ('earliest_available' as const)
    }));

  return [...days]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((day) => ({
      date: day.date,
      label: day.label,
      slots: sortedCandidates.filter((slot) => slot.date === day.date)
    }))
    .filter((day) => day.slots.length > 0);
}

function slotKey(date: string, time: string, technicianId: string) {
  return `${date}__${time}__${technicianId}`;
}
