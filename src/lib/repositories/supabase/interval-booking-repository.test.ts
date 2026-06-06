import { describe, expect, it } from 'vitest';
import { mockBookingItems, mockIntervalBookings } from '@/mock/interval-bookings';
import type { BookingItem, IntervalBooking } from '@/domain/booking';
import {
  rowToBookingItem,
  rowToIntervalBooking,
  type BookingItemRow,
  type BookingRow,
} from './interval-booking-repository';

// Mirror the seed/RPC camelCase -> snake_case mapping so we can round-trip without a DB.
function bookingToRow(b: IntervalBooking): BookingRow {
  return {
    id: b.id,
    merchant_id: b.merchantId,
    technician_id: b.technicianId,
    customer_name: b.customerName,
    style_title: b.styleTitle,
    style_image_url: b.styleImageUrl,
    start_at: b.startAt,
    end_at: b.endAt,
    duration_min: b.durationMin,
    status: b.status,
    notes: b.notes,
  };
}
function itemToRow(i: BookingItem): BookingItemRow {
  return {
    id: i.id,
    booking_id: i.bookingId,
    catalog_item_id: i.catalogItemId,
    label: i.label,
    price_cents: i.priceCents,
    duration_min: i.durationMin,
    quantity: i.quantity,
    pricing_unit: i.pricingUnit,
    affects_duration: i.affectsDuration,
  };
}

describe('supabase interval-booking row mappers', () => {
  it('round-trips every interval booking (booking -> row -> booking)', () => {
    for (const b of mockIntervalBookings) {
      expect(rowToIntervalBooking(bookingToRow(b))).toEqual(b);
    }
  });

  it('round-trips every booking item (item -> row -> item)', () => {
    for (const i of mockBookingItems) {
      expect(rowToBookingItem(itemToRow(i))).toEqual(i);
    }
  });

  it('preserves a null catalog_item_id on a booking item', () => {
    const mapped = rowToBookingItem({
      id: 'x',
      booking_id: 'b',
      catalog_item_id: null,
      label: 'freeform art',
      price_cents: 500,
      duration_min: 10,
      quantity: 2,
      pricing_unit: 'per_piece',
      affects_duration: true,
    });
    expect(mapped.catalogItemId).toBeNull();
    expect(mapped.quantity).toBe(2);
  });
});
