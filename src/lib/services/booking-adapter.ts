// IntervalBooking → flat UI `Booking` adapter (P4d). The reader surfaces (calendar, profile,
// booking detail) are typed against the flat `Booking` shape; this maps a DB interval booking +
// its items back into that shape so the cutover doesn't require rewriting every component at once.
// Per the cutover audit: write and reads move together through this adapter.

import type { BookingItem, BookingStatus as IntervalBookingStatus, IntervalBooking } from '@/domain/booking';
import type { AIRecognitionResult, Booking, TechnicianSnapshot } from '@/domain/nail';
import { instantToZonedParts } from './timezone';

export type IntervalBookingView = {
  booking: IntervalBooking;
  items: BookingItem[];
};

export type AdaptBookingOptions = {
  timeZone: string;
  technician: TechnicianSnapshot;
  merchantName: string;
  conversationId?: string;
};

// The interval model adds 'in_progress', which the flat UI status union does not have.
function toFlatStatus(status: IntervalBookingStatus): Booking['status'] {
  return status === 'in_progress' ? 'confirmed' : status;
}

// recognition is not persisted on an interval booking and is not read by any reader surface;
// a neutral placeholder keeps the flat Booking shape the UI components type against.
function neutralRecognition(priceCents: number, durationMin: number): AIRecognitionResult {
  return {
    selection: { baseServices: [], nailShape: 'round', styles: [], addons: [], otherNotes: '' },
    meta: {
      confidence: 1,
      aiSuggestedQuote: { source: 'ai_suggestion', price: priceCents / 100, duration: durationMin },
    },
  };
}

export function intervalBookingToUiBooking(
  { booking, items }: IntervalBookingView,
  { timeZone, technician, merchantName, conversationId }: AdaptBookingOptions,
): Booking {
  const { date, time } = instantToZonedParts(Date.parse(booking.startAt), timeZone);
  const priceCents = items.reduce((sum, item) => sum + item.priceCents, 0);

  return {
    id: booking.id,
    customerName: booking.customerName,
    merchantName,
    styleTitle: booking.styleTitle,
    styleImageUrl: booking.styleImageUrl,
    date,
    time,
    quote: { source: 'booking_snapshot', price: priceCents / 100, duration: booking.durationMin },
    status: toFlatStatus(booking.status),
    technician,
    conversationId,
    notes: booking.notes,
    recognition: neutralRecognition(priceCents, booking.durationMin),
  };
}
