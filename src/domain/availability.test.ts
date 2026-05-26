import { describe, expect, it } from 'vitest';
import type { Booking, Technician } from './nail';
import { findTechnicianSlots } from './availability';
import { mockBookings } from '@/mock/bookings';

const technicians: Technician[] = [
  { id: 'tech-mei', name: 'Mei Chen', initials: 'MC', title: 'Lead nail artist', active: true },
  { id: 'tech-lina', name: 'Lina Park', initials: 'LP', title: 'Gel specialist', active: true },
  { id: 'tech-anna', name: 'Anna Lim', initials: 'AL', title: 'Nail artist', active: false }
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

  it('returns no available days when there are no active technicians', () => {
    const result = findTechnicianSlots({
      bookings: [],
      days,
      technicians: technicians.map((technician) => ({ ...technician, active: false }))
    });

    expect(result).toEqual([]);
  });
});
