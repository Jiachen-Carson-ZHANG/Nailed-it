import type { BookingItem, BookingStatus, IntervalBooking } from '@/domain/booking';
import { intervalsOverlap, isValidRange } from '@/domain/scheduling';
import { mockBookingItems, mockIntervalBookings } from '@/mock/interval-bookings';
import type { ConversationRepository, IntervalBookingRepository } from '../types';

function toInterval(b: { startAt: string; endAt: string }) {
  return { startMs: new Date(b.startAt).getTime(), endMs: new Date(b.endAt).getTime() };
}

export function createMemoryIntervalBookingRepository(
  seedBookings: IntervalBooking[] = mockIntervalBookings,
  seedItems: BookingItem[] = mockBookingItems,
  // Injected so createWithThread can write the linked thread atomically (mirrors the DB RPC,
  // which spans both tables). The real bundle always passes it; standalone tests that only use
  // create() may omit it.
  conversations?: ConversationRepository,
): IntervalBookingRepository {
  const bookings: IntervalBooking[] = structuredClone(seedBookings);
  const items: BookingItem[] = structuredClone(seedItems);

  // Mirrors the DB CHECK (end_at > start_at) + GiST exclusion constraint, then commits the rows.
  function insertBooking(booking: IntervalBooking, newItems: BookingItem[]): IntervalBooking {
    const reqInterval = toInterval(booking);
    if (!isValidRange(reqInterval.startMs, reqInterval.endMs)) {
      throw new Error('invalid_interval');
    }
    const conflict = bookings.some(
      (b) =>
        b.technicianId === booking.technicianId &&
        b.status !== 'cancelled' &&
        intervalsOverlap(reqInterval, toInterval(b)),
    );
    if (conflict) {
      throw new Error('booking_overlap');
    }
    bookings.push(structuredClone(booking));
    items.push(...structuredClone(newItems));
    return structuredClone(booking);
  }

  function removeBooking(id: string): void {
    const idx = bookings.findIndex((b) => b.id === id);
    if (idx !== -1) bookings.splice(idx, 1);
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].bookingId === id) items.splice(i, 1);
    }
  }

  return {
    async getById(id: string): Promise<IntervalBooking | null> {
      const found = bookings.find((b) => b.id === id);
      return found ? structuredClone(found) : null;
    },

    async listByMerchant(merchantId: string): Promise<IntervalBooking[]> {
      return structuredClone(bookings.filter((b) => b.merchantId === merchantId));
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
      return insertBooking(booking, newItems);
    },

    async createWithThread(
      booking: IntervalBooking,
      newItems: BookingItem[],
      thread,
    ): Promise<IntervalBooking> {
      if (!conversations) {
        throw new Error('createWithThread requires a conversations repository');
      }
      // insertBooking throws before committing on overlap/invalid interval (nothing pushed).
      const created = insertBooking(booking, newItems);
      try {
        await conversations.insert(thread);
      } catch (threadError) {
        // Honour the atomic contract: undo the booking + items if the thread insert fails.
        removeBooking(booking.id);
        throw threadError;
      }
      return created;
    },

    async setStatus(id: string, status: BookingStatus): Promise<IntervalBooking | null> {
      const idx = bookings.findIndex((b) => b.id === id);
      if (idx === -1) return null;
      bookings[idx] = { ...bookings[idx], status };
      return structuredClone(bookings[idx]);
    },
  };
}
