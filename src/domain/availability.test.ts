import { describe, expect, it } from 'vitest';
import type { Booking, Technician } from './nail';
import { findTechnicianSlots } from './availability';
import { mockBookings } from '@/mock/bookings';

const technicians: Technician[] = [
  { id: 'tech-mei', merchantId: 'merchant-nailed-it', name: 'Mei Chen', initials: 'MC', title: 'Lead nail artist', active: true },
  { id: 'tech-lina', merchantId: 'merchant-nailed-it', name: 'Lina Park', initials: 'LP', title: 'Gel specialist', active: true },
  { id: 'tech-anna', merchantId: 'merchant-nailed-it', name: 'Anna Lim', initials: 'AL', title: 'Nail artist', active: false }
];

const days = [
  { label: 'Today', date: '2026-05-23', slots: ['10:00', '12:30'] },
  { label: 'Tomorrow', date: '2026-05-24', slots: ['11:00'] }
];

describe('findTechnicianSlots', () => {
  it('assigns active technicians to available slot choices', () => {
    const result = findTechnicianSlots({
      bookings: [],
      days,
      technicians
    });

    expect(result[0].slots[0]).toMatchObject({
      date: '2026-05-23',
      label: 'Today',
      time: '10:00',
      technician: { name: 'Lina Park' },
      rankReason: 'shortest_wait'
    });
    expect(result.flatMap((day) => day.slots).some((slot) => slot.technician.name === 'Anna Lim')).toBe(
      false
    );
  });

  it('blocks only the matching technician at a booked date and time', () => {
    const bookingAtTen: Booking = {
      ...mockBookings[0],
      date: '2026-05-23',
      time: '10:00',
      technician: { id: 'tech-mei', name: 'Mei Chen', initials: 'MC' },
      status: 'confirmed'
    };

    const result = findTechnicianSlots({
      bookings: [bookingAtTen],
      days,
      technicians
    });
    const todayTen = result[0].slots.filter((slot) => slot.time === '10:00');

    expect(todayTen).toHaveLength(1);
    expect(todayTen[0].technician.name).toBe('Lina Park');
  });

  it('sorts choices by earliest date, earliest time, then technician name', () => {
    const result = findTechnicianSlots({
      bookings: [],
      days: [
        { label: 'Tomorrow', date: '2026-05-24', slots: ['11:00'] },
        { label: 'Today', date: '2026-05-23', slots: ['12:30', '10:00'] }
      ],
      technicians
    });
    const flattened = result.flatMap((day) =>
      day.slots.map((slot) => `${slot.date} ${slot.time} ${slot.technician.name}`)
    );

    expect(flattened.slice(0, 3)).toEqual([
      '2026-05-23 10:00 Lina Park',
      '2026-05-23 10:00 Mei Chen',
      '2026-05-23 12:30 Lina Park'
    ]);
  });

  it('blocks overlapping later slots for the whole duration of a booking (duration-aware)', () => {
    // Mei booked 10:00 for 165 min → occupies 10:00–12:45, so the 12:30 slot must exclude Mei.
    // The old slot-string logic only marked 10:00 occupied and would have offered Mei at 12:30.
    const longBooking: Booking = {
      ...mockBookings[0],
      date: '2026-05-23',
      time: '10:00',
      technician: { id: 'tech-mei', name: 'Mei Chen', initials: 'MC' },
      status: 'confirmed',
      quote: { source: 'booking_snapshot', price: 100, duration: 165 }
    };

    const result = findTechnicianSlots({ bookings: [longBooking], days, technicians, durationMin: 60 });
    const today = result.find((day) => day.date === '2026-05-23');
    const twelveThirty = today?.slots.filter((slot) => slot.time === '12:30') ?? [];

    expect(twelveThirty.some((slot) => slot.technician.name === 'Mei Chen')).toBe(false);
    expect(twelveThirty.some((slot) => slot.technician.name === 'Lina Park')).toBe(true);
  });

  it('falls back to a positive duration instead of treating malformed durations as free', () => {
    const malformedDurationBooking: Booking = {
      ...mockBookings[0],
      date: '2026-05-23',
      time: '12:30',
      technician: { id: 'tech-mei', name: 'Mei Chen', initials: 'MC' },
      status: 'confirmed',
      quote: { source: 'booking_snapshot', price: 100, duration: 0 }
    };

    const result = findTechnicianSlots({
      bookings: [malformedDurationBooking],
      days,
      technicians,
      durationMin: 0
    });
    const twelveThirty = result
      .find((day) => day.date === '2026-05-23')
      ?.slots.filter((slot) => slot.time === '12:30') ?? [];

    expect(twelveThirty.some((slot) => slot.technician.name === 'Mei Chen')).toBe(false);
    expect(twelveThirty.some((slot) => slot.technician.name === 'Lina Park')).toBe(true);
  });

  it('returns no available days when there are no active technicians', () => {
    const result = findTechnicianSlots({
      bookings: [],
      days,
      technicians: technicians.map((technician) => ({ ...technician, active: false }))
    });

    expect(result).toEqual([]);
  });
});
