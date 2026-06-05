import type { BookingItem, BookingStatus, IntervalBooking } from '@/domain/booking';
import { intervalsOverlap } from '@/domain/scheduling';
import { mockBookingItems, mockIntervalBookings } from '@/mock/interval-bookings';
import type { IntervalBookingRepository } from '../types';

function toInterval(b: { startAt: string; endAt: string }) {
  return { startMs: new Date(b.startAt).getTime(), endMs: new Date(b.endAt).getTime() };
}

export function createMemoryIntervalBookingRepository(
  seedBookings: IntervalBooking[] = mockIntervalBookings,
  seedItems: BookingItem[] = mockBookingItems,
): IntervalBookingRepository {
  const bookings: IntervalBooking[] = structuredClone(seedBookings);
  const items: BookingItem[] = structuredClone(seedItems);

  return {
    async getById(id: string): Promise<IntervalBooking | null> {
      const found = bookings.find((b) => b.id === id);
      return found ? structuredClone(found) : null;
    },

    async listByTechnicianInRange(
      technicianId: string,
      startAt: string,
      endAt: string,
    ): Promise<IntervalBooking[]> {
      const reqInterval = toInterval({ startAt, endAt });
      return structuredClone(
        bookings.filter(
          (b) =>
            b.technicianId === technicianId &&
            b.status !== 'cancelled' &&
            intervalsOverlap(reqInterval, toInterval(b)),
        ),
      );
    },

    async listItems(bookingId: string): Promise<BookingItem[]> {
      return structuredClone(items.filter((it) => it.bookingId === bookingId));
    },

    async create(booking: IntervalBooking, newItems: BookingItem[]): Promise<IntervalBooking> {
      // Mirror the DB exclusion constraint: no overlapping live booking for this technician.
      const conflict = bookings.some(
        (b) =>
          b.technicianId === booking.technicianId &&
          b.status !== 'cancelled' &&
          intervalsOverlap(toInterval(booking), toInterval(b)),
      );
      if (conflict) {
        throw new Error('booking_overlap');
      }
      bookings.push(structuredClone(booking));
      items.push(...structuredClone(newItems));
      return structuredClone(booking);
    },

    async setStatus(id: string, status: BookingStatus): Promise<IntervalBooking | null> {
      const idx = bookings.findIndex((b) => b.id === id);
      if (idx === -1) return null;
      bookings[idx] = { ...bookings[idx], status };
      return structuredClone(bookings[idx]);
    },
  };
}
