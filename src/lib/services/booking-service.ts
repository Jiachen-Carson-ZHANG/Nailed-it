// bookingService — see ADR-0005 (P4b). Orchestrates create (quote → resolve slot → transactional
// create) and the status lifecycle. The no-double-book guarantee is the repo/DB's job
// (create throws 'booking_overlap'); this layer adds tenant + pricing + duration validation.

import { randomUUID } from 'node:crypto';
import type { BookingItem, BookingStatus, IntervalBooking } from '@/domain/booking';
import type { BookingConversationThread } from '@/domain/nail';
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

/**
 * Bridge create for the P4c/P4d cutover: the current UI still produces a flat estimate (price +
 * duration), not catalog selections, so the booking is created with a single synthetic
 * booking_item snapshot (catalogItemId null) instead of a quoteService quote. Everything else —
 * the interval, the tenant guard, the transactional create + exclusion constraint — is identical.
 * When the live recognizer emits catalog ids (P6), callers switch to createBooking; the booking /
 * booking_item tables and the reader surfaces do not change again.
 */
export type CreateBookingFromSnapshotInput = {
  merchantId: string;
  technicianId: string;
  customerName: string;
  styleTitle: string;
  styleImageUrl: string;
  date: string;
  time: string;
  estimate: { price: number; duration: number };
  status?: BookingStatus;
  notes?: string;
};

export type BookingService = {
  createBooking(input: CreateBookingInput): Promise<IntervalBooking>;
  /**
   * Like createBooking (catalog selections → quoteService → relational booking_items), but also
   * creates the conversation thread in the same atomic step. Used for booking a published merchant
   * style from its curated catalogBreakdown.
   */
  createBookingWithThreadFromSelections(
    input: CreateBookingInput,
    buildThread: (booking: IntervalBooking) => BookingConversationThread,
  ): Promise<IntervalBooking>;
  createBookingFromSnapshot(input: CreateBookingFromSnapshotInput): Promise<IntervalBooking>;
  /**
   * Like createBookingFromSnapshot, but creates the booking and its conversation thread in one
   * atomic step (no compensating cancel). `buildThread` is given the constructed booking so the
   * caller can derive the thread (its id / bookingId / greeting) from the server-generated id.
   */
  createBookingWithThreadFromSnapshot(
    input: CreateBookingFromSnapshotInput,
    buildThread: (booking: IntervalBooking) => BookingConversationThread,
  ): Promise<IntervalBooking>;
  cancel(id: string): Promise<IntervalBooking | null>;
  setStatus(id: string, status: BookingStatus): Promise<IntervalBooking | null>;
};

export function createBookingService(repos: RepositoryBundle): BookingService {
  const quoteService = createQuoteService(repos);

  // Resolves the merchant and enforces the tenant guard (the DB composite FK is the backstop):
  // the technician must belong to this merchant. Returns the merchant (for its timezone).
  async function resolveMerchantWithTechnicianGuard(merchantId: string, technicianId: string) {
    const merchant = await repos.merchants.getById(merchantId);
    if (!merchant) throw new Error(`unknown_merchant: ${merchantId}`);
    const technician = (await repos.technicians.list()).find((t) => t.id === technicianId);
    if (!technician || technician.merchantId !== merchantId) {
      throw new Error('technician_not_in_merchant');
    }
    return merchant;
  }

  // Builds the interval booking + its single synthetic snapshot item (the P4c bridge: the flat
  // estimate becomes one booking_item with catalogItemId null, until P6 supplies catalog ids).
  // Enforces the tenant guard + positive duration; does not write.
  async function buildSnapshot(input: CreateBookingFromSnapshotInput) {
    const merchant = await resolveMerchantWithTechnicianGuard(input.merchantId, input.technicianId);
    const durationMin = input.estimate.duration;
    if (!(durationMin > 0)) throw new Error('zero_duration');

    const request = resolveSlot(merchant.timezone, input.date, input.time, durationMin);
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
      durationMin,
      status: input.status ?? 'confirmed',
      notes: input.notes ?? '',
    };
    const item: BookingItem = {
      id: `bitem-${randomUUID()}`,
      bookingId,
      catalogItemId: null,
      label: 'AI style quote snapshot',
      priceCents: Math.max(0, Math.round(input.estimate.price * 100)),
      durationMin,
      quantity: 1,
      pricingUnit: 'fixed',
      affectsDuration: true,
    };
    return { booking, item };
  }

  // Builds the interval booking + its relational booking_items from catalog selections, pricing
  // them through quoteService (real catalog ids, per-line price/duration). Enforces the tenant
  // guard + positive duration; does not write.
  async function buildFromSelections(input: CreateBookingInput) {
    const merchant = await resolveMerchantWithTechnicianGuard(input.merchantId, input.technicianId);

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
    return { booking, items };
  }

  return {
    async createBooking(input: CreateBookingInput): Promise<IntervalBooking> {
      const { booking, items } = await buildFromSelections(input);
      // Throws 'booking_overlap' if the interval collides (exclusion constraint / in-memory mirror).
      return repos.intervalBookings.create(booking, items);
    },

    async createBookingWithThreadFromSelections(
      input: CreateBookingInput,
      buildThread: (booking: IntervalBooking) => BookingConversationThread,
    ): Promise<IntervalBooking> {
      const { booking, items } = await buildFromSelections(input);
      return repos.intervalBookings.createWithThread(booking, items, buildThread(booking));
    },

    async createBookingFromSnapshot(input: CreateBookingFromSnapshotInput): Promise<IntervalBooking> {
      const { booking, item } = await buildSnapshot(input);
      return repos.intervalBookings.create(booking, [item]);
    },

    async createBookingWithThreadFromSnapshot(
      input: CreateBookingFromSnapshotInput,
      buildThread: (booking: IntervalBooking) => BookingConversationThread,
    ): Promise<IntervalBooking> {
      const { booking, item } = await buildSnapshot(input);
      return repos.intervalBookings.createWithThread(booking, [item], buildThread(booking));
    },

    async cancel(id: string): Promise<IntervalBooking | null> {
      return repos.intervalBookings.setStatus(id, 'cancelled');
    },

    async setStatus(id: string, status: BookingStatus): Promise<IntervalBooking | null> {
      return repos.intervalBookings.setStatus(id, status);
    },
  };
}
