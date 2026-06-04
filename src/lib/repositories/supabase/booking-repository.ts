import { getServiceClient } from '@/lib/db/client';
import type { Booking } from '@/domain/nail';
import type { BookingRepository } from '../types';

interface BookingRow {
  id: string;
  customer_name: string;
  merchant_name: string;
  style_title: string;
  style_image_url: string;
  date: string;
  time: string;
  quote: Booking['quote'];
  status: string;
  technician: Booking['technician'];
  conversation_id: string | null;
  notes: string;
  recognition: Booking['recognition'];
  created_at: string;
}

function rowToBooking(row: BookingRow): Booking {
  const booking: Booking = {
    id: row.id,
    customerName: row.customer_name,
    merchantName: row.merchant_name,
    styleTitle: row.style_title,
    styleImageUrl: row.style_image_url,
    date: row.date,
    time: row.time,
    quote: row.quote,
    status: row.status as Booking['status'],
    technician: row.technician,
    notes: row.notes,
    recognition: row.recognition,
  };
  if (row.conversation_id !== null) {
    booking.conversationId = row.conversation_id;
  }
  return booking;
}

function bookingToRow(booking: Booking): Omit<BookingRow, 'created_at'> {
  return {
    id: booking.id,
    customer_name: booking.customerName,
    merchant_name: booking.merchantName,
    style_title: booking.styleTitle,
    style_image_url: booking.styleImageUrl,
    date: booking.date,
    time: booking.time,
    quote: booking.quote,
    status: booking.status,
    technician: booking.technician,
    conversation_id: booking.conversationId ?? null,
    notes: booking.notes,
    recognition: booking.recognition,
  };
}

export function createSupabaseBookingRepository(): BookingRepository {
  return {
    async list(): Promise<Booking[]> {
      const { data, error } = await getServiceClient()
        .from('bookings')
        .select('*');
      if (error) {
        throw new Error(`BookingRepository.list failed: ${error.message}`);
      }
      return (data as BookingRow[]).map(rowToBooking);
    },

    async getById(id: string): Promise<Booking | null> {
      const { data, error } = await getServiceClient()
        .from('bookings')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        throw new Error(`BookingRepository.getById failed: ${error.message}`);
      }
      return data ? rowToBooking(data as BookingRow) : null;
    },

    async insert(booking: Booking): Promise<Booking> {
      const row = bookingToRow(booking);
      const { data, error } = await getServiceClient()
        .from('bookings')
        .insert(row)
        .select('*')
        .single();
      if (error) {
        throw new Error(`BookingRepository.insert failed: ${error.message}`);
      }
      return rowToBooking(data as BookingRow);
    },

    async updateStatus(id: string, status: Booking['status']): Promise<Booking | null> {
      const { data, error } = await getServiceClient()
        .from('bookings')
        .update({ status })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) {
        throw new Error(`BookingRepository.updateStatus failed: ${error.message}`);
      }
      return data ? rowToBooking(data as BookingRow) : null;
    },
  };
}
