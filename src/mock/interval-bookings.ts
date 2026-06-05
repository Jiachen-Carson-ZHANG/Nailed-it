import type { BookingItem, IntervalBooking } from '@/domain/booking';
import type { StaffItemDuration } from '@/domain/scheduling';
import { mockBookings } from './bookings';
import { demoMerchantId } from './merchants';

// The interval `booking` table is the demo source for the DB cutover. We derive it from the flat
// mockBookings (same ids, dates, technicians, statuses) so the reader surfaces show the same rich
// demo as before and the existing seed conversation threads still link by booking id. Each booking
// gets one synthetic snapshot booking_item carrying its flat price/duration (the P4c bridge), until
// the live recognizer (P6) emits real catalog ids.

function sgtMs(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00+08:00`);
}

export const mockIntervalBookings: IntervalBooking[] = mockBookings.map((b) => {
  const startMs = sgtMs(b.date, b.time);
  return {
    id: b.id,
    merchantId: demoMerchantId,
    technicianId: b.technician.id,
    customerName: b.customerName,
    styleTitle: b.styleTitle,
    styleImageUrl: b.styleImageUrl,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(startMs + b.quote.duration * 60_000).toISOString(),
    durationMin: b.quote.duration,
    status: b.status,
    notes: b.notes,
  };
});

export const mockBookingItems: BookingItem[] = mockBookings.map((b) => ({
  id: `bitem-${b.id}`,
  bookingId: b.id,
  catalogItemId: null,
  label: b.styleTitle,
  priceCents: Math.round(b.quote.price * 100),
  durationMin: b.quote.duration,
  quantity: 1,
  pricingUnit: 'fixed',
  affectsDuration: true,
}));

// Illustrative per-staff duration overrides (the catalog item used here is a demo stand-in;
// real rows attach to items whose duration_config_level = 'staff_level').
export const mockStaffItemDurations: StaffItemDuration[] = [
  { technicianId: 'tech-mei', catalogItemId: 'basic_manicure_service', durationMin: 45 },
  { technicianId: 'tech-lina', catalogItemId: 'basic_manicure_service', durationMin: 50 },
];
