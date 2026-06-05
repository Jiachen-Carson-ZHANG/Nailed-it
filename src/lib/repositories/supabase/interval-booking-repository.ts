import { getServiceClient } from '@/lib/db/client';
import type { BookingItem, BookingStatus, IntervalBooking } from '@/domain/booking';
import type { PricingUnit } from '@/domain/catalog';
import type { IntervalBookingRepository } from '../types';

export interface BookingRow {
  id: string;
  merchant_id: string;
  technician_id: string;
  customer_name: string;
  style_title: string;
  style_image_url: string;
  start_at: string;
  end_at: string;
  duration_min: number;
  status: string;
  notes: string;
}

export interface BookingItemRow {
  id: string;
  booking_id: string;
  catalog_item_id: string | null;
  label: string;
  price_cents: number;
  duration_min: number;
  quantity: number;
  pricing_unit: string;
  affects_duration: boolean;
}

export function rowToIntervalBooking(row: BookingRow): IntervalBooking {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    technicianId: row.technician_id,
    customerName: row.customer_name,
    styleTitle: row.style_title,
    styleImageUrl: row.style_image_url,
    startAt: row.start_at,
    endAt: row.end_at,
    durationMin: row.duration_min,
    status: row.status as BookingStatus,
    notes: row.notes,
  };
}

export function rowToBookingItem(row: BookingItemRow): BookingItem {
  return {
    id: row.id,
    bookingId: row.booking_id,
    catalogItemId: row.catalog_item_id,
    label: row.label,
    priceCents: row.price_cents,
    durationMin: row.duration_min,
    quantity: row.quantity,
    pricingUnit: row.pricing_unit as PricingUnit,
    affectsDuration: row.affects_duration,
  };
}

function bookingToPayload(b: IntervalBooking) {
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

function itemToPayload(i: BookingItem) {
  return {
    id: i.id,
    catalog_item_id: i.catalogItemId,
    label: i.label,
    price_cents: i.priceCents,
    duration_min: i.durationMin,
    quantity: i.quantity,
    pricing_unit: i.pricingUnit,
    affects_duration: i.affectsDuration,
  };
}

export function createSupabaseIntervalBookingRepository(): IntervalBookingRepository {
  return {
    async getById(id: string): Promise<IntervalBooking | null> {
      const { data, error } = await getServiceClient()
        .from('booking')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        throw new Error(`IntervalBookingRepository.getById failed: ${error.message}`);
      }
      return data ? rowToIntervalBooking(data as BookingRow) : null;
    },

    async listByMerchant(merchantId: string): Promise<IntervalBooking[]> {
      const { data, error } = await getServiceClient()
        .from('booking')
        .select('*')
        .eq('merchant_id', merchantId);
      if (error) {
        throw new Error(`IntervalBookingRepository.listByMerchant failed: ${error.message}`);
      }
      return (data as BookingRow[]).map(rowToIntervalBooking);
    },

    async listByTechnicianInRange(
      technicianId: string,
      startAt: string,
      endAt: string,
    ): Promise<IntervalBooking[]> {
      const { data, error } = await getServiceClient()
        .from('booking')
        .select('*')
        .eq('technician_id', technicianId)
        .neq('status', 'cancelled')
        .lt('start_at', endAt)
        .gt('end_at', startAt);
      if (error) {
        throw new Error(`IntervalBookingRepository.listByTechnicianInRange failed: ${error.message}`);
      }
      return (data as BookingRow[]).map(rowToIntervalBooking);
    },

    async listItems(bookingId: string): Promise<BookingItem[]> {
      const { data, error } = await getServiceClient()
        .from('booking_item')
        .select('*')
        .eq('booking_id', bookingId);
      if (error) {
        throw new Error(`IntervalBookingRepository.listItems failed: ${error.message}`);
      }
      return (data as BookingItemRow[]).map(rowToBookingItem);
    },

    async create(booking: IntervalBooking, items: BookingItem[]): Promise<IntervalBooking> {
      const { error } = await getServiceClient().rpc('create_booking', {
        p_booking: bookingToPayload(booking),
        p_items: items.map(itemToPayload),
      });
      if (error) {
        if (error.code === '23P01' || error.message?.includes('booking_overlap')) {
          throw new Error('booking_overlap');
        }
        // 23514 = check_violation (end_at > start_at, duration_min > 0).
        if (error.code === '23514') {
          throw new Error('invalid_interval');
        }
        throw new Error(`IntervalBookingRepository.create failed: ${error.message}`);
      }
      return booking;
    },

    async setStatus(id: string, status: BookingStatus): Promise<IntervalBooking | null> {
      const { data, error } = await getServiceClient()
        .from('booking')
        .update({ status })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) {
        throw new Error(`IntervalBookingRepository.setStatus failed: ${error.message}`);
      }
      return data ? rowToIntervalBooking(data as BookingRow) : null;
    },
  };
}
