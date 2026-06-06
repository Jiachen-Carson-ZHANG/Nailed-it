import type { Booking, Technician, TechnicianSlot } from './nail';
import { intervalsOverlap } from './scheduling';

const fallbackDurationMin = 60;

type FindTechnicianSlotsInput = {
  bookings: Booking[];
  days: Array<{
    date: string;
    label: string;
    slots: string[];
  }>;
  technicians: Technician[];
  /** Length of the slot being booked, in minutes. Defaults to 60. */
  durationMin?: number;
};

export type TechnicianSlotDay = {
  date: string;
  label: string;
  slots: TechnicianSlot[];
};

function durationOrFallback(durationMin: number | undefined): number {
  return typeof durationMin === 'number' && Number.isFinite(durationMin) && durationMin > 0
    ? durationMin
    : fallbackDurationMin;
}

// Demo merchant timezone is Asia/Singapore (no DST), so a fixed +08:00 offset is exact.
// Availability is duration-aware: occupancy is a real time interval, not a slot string,
// so a long booking blocks every overlapping later slot — not just its exact start time.
function slotMs(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00+08:00`);
}

export function findTechnicianSlots({
  bookings,
  days,
  technicians,
  durationMin = fallbackDurationMin
}: FindTechnicianSlotsInput): TechnicianSlotDay[] {
  const requestDurationMin = durationOrFallback(durationMin);
  const busyByTechnician = new Map<string, Array<{ startMs: number; endMs: number }>>();
  for (const booking of bookings) {
    if (booking.status === 'cancelled') continue;
    const startMs = slotMs(booking.date, booking.time);
    const interval = { startMs, endMs: startMs + durationOrFallback(booking.quote.duration) * 60_000 };
    if (!busyByTechnician.has(booking.technician.id)) {
      busyByTechnician.set(booking.technician.id, []);
    }
    busyByTechnician.get(booking.technician.id)!.push(interval);
  }

  const activeTechnicians = technicians.filter((technician) => technician.active);
  const sortedCandidates = days
    .flatMap((day) =>
      day.slots.flatMap((time) => {
        const startMs = slotMs(day.date, time);
        const request = { startMs, endMs: startMs + requestDurationMin * 60_000 };
        return activeTechnicians
          .filter((technician) => {
            const busy = busyByTechnician.get(technician.id) ?? [];
            return !busy.some((interval) => intervalsOverlap(request, interval));
          })
          .map<TechnicianSlot>((technician) => ({
            date: day.date,
            label: day.label,
            time,
            technician: {
              id: technician.id,
              name: technician.name,
              initials: technician.initials
            }
          }));
      })
    )
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
