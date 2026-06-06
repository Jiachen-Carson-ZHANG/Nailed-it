import type { Booking } from '@/domain/nail';
import { mockBookings } from '@/mock/bookings';
import type { BookingRepository } from '../types';

export function createMemoryBookingRepository(
  seed: Booking[] = mockBookings,
): BookingRepository {
  let state: Booking[] = structuredClone(seed);

  return {
    async list(): Promise<Booking[]> {
      return structuredClone(state);
    },

    async getById(id: string): Promise<Booking | null> {
      const found = state.find((b) => b.id === id);
      return found ? structuredClone(found) : null;
    },

    async insert(booking: Booking): Promise<Booking> {
      const clone = structuredClone(booking);
      state = [...state, clone];
      return structuredClone(clone);
    },

    async updateStatus(id: string, status: Booking['status']): Promise<Booking | null> {
      const index = state.findIndex((b) => b.id === id);
      if (index === -1) return null;
      state = state.map((b, i) => (i === index ? { ...b, status } : b));
      return structuredClone(state[index]);
    },
  };
}
