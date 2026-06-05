// Interval-based booking domain contract — see ADR-0005 (P4a). This is the target model
// that supersedes the flat date/time-string `Booking` in nail.ts (retired in P4e). Kept in
// a separate module so flat-model UI consumers are untouched until P4c wires this in.

import type { PricingUnit } from './catalog';

export const bookingStatuses = [
  'pending_review',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type BookingStatus = (typeof bookingStatuses)[number];

/** One line of the persisted 积木 decomposition = a quote snapshot at booking time. */
export type BookingItem = {
  id: string;
  bookingId: string;
  catalogItemId: string | null;
  label: string;
  priceCents: number;
  durationMin: number;
  quantity: number;
  pricingUnit: PricingUnit;
  affectsDuration: boolean;
};

/** A booking as a concrete time interval that locks a technician (start_at … end_at). */
export type IntervalBooking = {
  id: string;
  merchantId: string;
  technicianId: string;
  customerName: string;
  styleTitle: string;
  styleImageUrl: string;
  startAt: string;
  endAt: string;
  durationMin: number;
  status: BookingStatus;
  notes: string;
};
