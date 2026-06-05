// bookingService — see ADR-0005 (P4b). Orchestrates create (quote → resolve slot → transactional
// create) and the status lifecycle. The no-double-book guarantee is the repo/DB's job
// (create throws 'booking_overlap'); this layer adds tenant + pricing + duration validation.

import { randomUUID } from 'node:crypto';
import type { BookingItem, BookingStatus, IntervalBooking } from '@/domain/booking';
import type { RepositoryBundle } from '@/lib/repositories/types';
import { createQuoteService, type QuoteSelection } from './quote-service';
import { resolveSlot } from './timezone';

export type CreateBookingInput = {
  merchantId: string;
  technicianId: string;
  customerName: string;
  styleTitle: string;
  styleImageUrl: string;
  date: string;
  time: string;
  selections: QuoteSelection[];
  notes?: string;
  status?: BookingStatus;
};

export type BookingService = {
  createBooking(input: CreateBookingInput): Promise<IntervalBooking>;
  cancel(id: string): Promise<IntervalBooking | null>;
  setStatus(id: string, status: BookingStatus): Promise<IntervalBooking | null>;
};

export function createBookingService(repos: RepositoryBundle): BookingService {
  const quoteService = createQuoteService(repos);

  return {
    async createBooking(input: CreateBookingInput): Promise<IntervalBooking> {
      const merchant = await repos.merchants.getById(input.merchantId);
      if (!merchant) throw new Error(`unknown_merchant: ${input.merchantId}`);

      // Tenant guard (the DB composite FK is the backstop): the technician must belong here.
      const technician = (await repos.technicians.list()).find((t) => t.id === input.technicianId);
      if (!technician || technician.merchantId !== input.merchantId) {
        throw new Error('technician_not_in_merchant');
      }

      const quote = await quoteService.buildQuote({
        merchantId: input.merchantId,
        technicianId: input.technicianId,
        selections: input.selections,
      });
      if (quote.totalDurationMin <= 0) throw new Error('zero_duration');

      const request = resolveSlot(merchant.timezone, input.date, input.time, quote.totalDurationMin);
      const bookingId = `booking-${randomUUID()}`;
      const booking: IntervalBooking = {
        id: bookingId,
        merchantId: input.merchantId,
        technicianId: input.technicianId,
        customerName: input.customerName,
        styleTitle: input.styleTitle,
        styleImageUrl: input.styleImageUrl,
        startAt: new Date(request.interval.startMs).toISOString(),
        endAt: new Date(request.interval.endMs).toISOString(),
        durationMin: quote.totalDurationMin,
        status: input.status ?? 'confirmed',
        notes: input.notes ?? '',
      };
      const items: BookingItem[] = quote.lines.map((l) => ({
        id: `bitem-${randomUUID()}`,
        bookingId,
        catalogItemId: l.catalogItemId,
        label: l.label,
        priceCents: l.linePriceCents,
        durationMin: l.durationMin,
        quantity: l.quantity,
        pricingUnit: l.pricingUnit,
        affectsDuration: l.affectsDuration,
      }));

      // Throws 'booking_overlap' if the interval collides (exclusion constraint / in-memory mirror).
      return repos.intervalBookings.create(booking, items);
    },

    async cancel(id: string): Promise<IntervalBooking | null> {
      return repos.intervalBookings.setStatus(id, 'cancelled');
    },

    async setStatus(id: string, status: BookingStatus): Promise<IntervalBooking | null> {
      return repos.intervalBookings.setStatus(id, status);
    },
  };
}
