import type { BookingItem, IntervalBooking } from '@/domain/booking';
import type { StaffItemDuration } from '@/domain/scheduling';
import { demoMerchantId } from './merchants';

// Two non-overlapping demo interval bookings (Tue 2026-06-09, Asia/Singapore) so P4b
// availability has occupancy to subtract. Must stay overlap-free per technician or the
// DB exclusion constraint (and the in-memory mirror) will reject the seed.
export const mockIntervalBookings: IntervalBooking[] = [
  {
    id: 'booking-int-001',
    merchantId: demoMerchantId,
    technicianId: 'tech-lina',
    customerName: 'Demo Customer',
    styleTitle: 'Rose Cat Eye Shine',
    styleImageUrl: '',
    startAt: '2026-06-09T10:00:00+08:00',
    endAt: '2026-06-09T11:30:00+08:00',
    durationMin: 90,
    status: 'confirmed',
    notes: '',
  },
  {
    id: 'booking-int-002',
    merchantId: demoMerchantId,
    technicianId: 'tech-mei',
    customerName: 'Demo Customer',
    styleTitle: 'French Tip Classic',
    styleImageUrl: '',
    startAt: '2026-06-09T14:00:00+08:00',
    endAt: '2026-06-09T15:15:00+08:00',
    durationMin: 75,
    status: 'confirmed',
    notes: '',
  },
];

export const mockBookingItems: BookingItem[] = [
  {
    id: 'bitem-001',
    bookingId: 'booking-int-001',
    catalogItemId: 'basic_manicure_service',
    label: '基础修甲',
    priceCents: 3500,
    durationMin: 60,
    quantity: 1,
    pricingUnit: 'fixed',
    affectsDuration: true,
  },
  {
    id: 'bitem-002',
    bookingId: 'booking-int-002',
    catalogItemId: 'basic_manicure_service',
    label: '基础修甲',
    priceCents: 3500,
    durationMin: 60,
    quantity: 1,
    pricingUnit: 'fixed',
    affectsDuration: true,
  },
];

// Illustrative per-staff duration overrides (the catalog item used here is a demo stand-in;
// real rows attach to items whose duration_config_level = 'staff_level').
export const mockStaffItemDurations: StaffItemDuration[] = [
  { technicianId: 'tech-mei', catalogItemId: 'basic_manicure_service', durationMin: 45 },
  { technicianId: 'tech-lina', catalogItemId: 'basic_manicure_service', durationMin: 50 },
];
