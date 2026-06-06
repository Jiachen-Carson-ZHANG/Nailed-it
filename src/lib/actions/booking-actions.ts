'use server';

import { randomUUID } from 'node:crypto';
import type { TechnicianSlotDay } from '@/domain/availability';
import { calculateEstimate } from '@/domain/pricing';
import type { AIRecognitionResult, Booking, BookingConversationThread } from '@/domain/nail';
import { requiresMerchantReview } from '@/domain/nail';
import type { RepositoryBundle } from '@/lib/repositories';
import { getRepositories } from '@/lib/repositories';
import { intervalBookingToUiBooking } from '@/lib/services/booking-adapter';
import { createBookingService } from '@/lib/services/booking-service';
import { getAvailableBookingDays } from '@/mock/bookings';
import { demoMerchantId } from '@/mock/merchants';
import { demoCustomerName } from '@/mock/operations-store';

// NOTE on trust: this app has no auth yet, so there is no authenticated session to derive a real
// actor from. These actions therefore fix the identity to the single demo customer/merchant and
// recompute money/status server-side rather than trusting the browser. True multi-actor
// authorization (a customer cannot invoke the merchant-scoped reads) needs the auth system —
// tracked as a follow-up, not solvable here.

async function adaptMerchantBookings(repos: RepositoryBundle): Promise<Booking[]> {
  const merchant = await repos.merchants.getById(demoMerchantId);
  const merchantName = merchant?.name ?? 'Nailed-it Studio';
  const timeZone = merchant?.timezone ?? 'Asia/Singapore';

  const [bookings, technicians, threads] = await Promise.all([
    repos.intervalBookings.listByMerchant(demoMerchantId),
    repos.technicians.list(),
    repos.conversations.list(),
  ]);
  const techById = new Map(technicians.map((t) => [t.id, t]));
  const threadByBooking = new Map(threads.map((t) => [t.bookingId, t.id]));

  return Promise.all(
    bookings.map(async (b) => {
      const items = await repos.intervalBookings.listItems(b.id);
      const tech = techById.get(b.technicianId);
      return intervalBookingToUiBooking(
        { booking: b, items },
        {
          timeZone,
          technician: tech
            ? { id: tech.id, name: tech.name, initials: tech.initials }
            : { id: b.technicianId, name: 'Technician', initials: '–' },
          merchantName,
          conversationId: threadByBooking.get(b.id),
        },
      );
    }),
  );
}

/** Merchant surfaces (calendar, booking detail): the whole shop's bookings. */
export async function listMerchantBookingViewsAction(): Promise<Booking[]> {
  return adaptMerchantBookings(getRepositories());
}

/** Customer surface (profile): only the demo customer's bookings — filtered on the server so other
 * customers' bookings never reach the browser. */
export async function listCustomerBookingViewsAction(): Promise<Booking[]> {
  const all = await adaptMerchantBookings(getRepositories());
  return all.filter((b) => b.customerName === demoCustomerName);
}

/** Persist a booking status change (merchant booking detail). */
export async function setBookingStatusAction(
  id: string,
  status: Booking['status'],
): Promise<Booking | null> {
  const updated = await createBookingService(getRepositories()).setStatus(id, status);
  if (!updated) return null;
  const all = await adaptMerchantBookings(getRepositories());
  return all.find((b) => b.id === id) ?? null;
}

/**
 * Availability for the confirm-page grid, computed against DB occupancy. (Still uses the legacy
 * slot helper + fixed template dates; replacing it with availabilityService over working_plan +
 * future dates is the next hardening commit.)
 */
export async function listAvailableSlotsAction(durationMin: number): Promise<TechnicianSlotDay[]> {
  const repos = getRepositories();
  const merchant = await repos.merchants.getById(demoMerchantId);
  const merchantName = merchant?.name ?? 'Nailed-it Studio';
  const timeZone = merchant?.timezone ?? 'Asia/Singapore';

  const [bookings, technicians] = await Promise.all([
    repos.intervalBookings.listByMerchant(demoMerchantId),
    repos.technicians.list(),
  ]);
  const techById = new Map(technicians.map((t) => [t.id, t]));

  const flat = bookings.map((b) => {
    const tech = techById.get(b.technicianId);
    return intervalBookingToUiBooking(
      { booking: b, items: [] },
      {
        timeZone,
        merchantName,
        technician: tech
          ? { id: tech.id, name: tech.name, initials: tech.initials }
          : { id: b.technicianId, name: 'Technician', initials: '–' },
      },
    );
  });

  return getAvailableBookingDays(flat, durationMin);
}

// The browser supplies the recognition + chosen slot, never the price, status, or customer name.
export type CreateBookingActionInput = {
  technicianId: string;
  recognition: AIRecognitionResult;
  styleTitle: string;
  styleImageUrl: string;
  date: string;
  time: string;
  notes: string;
};

/**
 * Create a booking + its conversation thread. Identity (customer), money (price/duration), and
 * status are all derived server-side: the price/duration are recomputed from the recognition via
 * the DB pricing rules, and the review status from the recognition confidence. The browser cannot
 * book a $0, one-minute, auto-confirmed appointment.
 */
export async function createBookingAction(input: CreateBookingActionInput): Promise<Booking> {
  const repos = getRepositories();
  const merchant = await repos.merchants.getById(demoMerchantId);
  const merchantName = merchant?.name ?? 'Nailed-it Studio';
  const timeZone = merchant?.timezone ?? 'Asia/Singapore';

  const customerName = demoCustomerName;
  const pricingRules = await repos.pricing.list();
  const estimate = calculateEstimate(input.recognition, pricingRules);
  const status: Booking['status'] = requiresMerchantReview(input.recognition)
    ? 'pending_review'
    : 'confirmed';

  const booking = await createBookingService(repos).createBookingFromSnapshot({
    merchantId: demoMerchantId,
    technicianId: input.technicianId,
    customerName,
    styleTitle: input.styleTitle,
    styleImageUrl: input.styleImageUrl,
    date: input.date,
    time: input.time,
    estimate: { price: estimate.price, duration: estimate.duration },
    status,
    notes: input.notes,
  });

  const technician = (await repos.technicians.list()).find((t) => t.id === booking.technicianId);
  const technicianName = technician?.name ?? 'your technician';

  const threadId = `conv-${booking.id}`;
  const thread: BookingConversationThread = {
    id: threadId,
    bookingId: booking.id,
    customerName,
    merchantName,
    relatedBookingTime: `${input.date} ${input.time}`,
    messages: [
      {
        id: `msg-${randomUUID()}`,
        authorRole: 'system',
        body:
          status === 'confirmed'
            ? `Your appointment is confirmed with ${technicianName} at ${input.time}.`
            : `Your appointment is pending merchant review with ${technicianName} at ${input.time}.`,
        sentAt: 'Now',
      },
    ],
  };
  // The booking is already committed by the RPC. If the thread insert fails we must not leave a
  // confirmed booking with no conversation (and a slot that retry would collide with): compensate
  // by cancelling the booking, which frees the slot (the exclusion constraint excludes cancelled).
  try {
    await repos.conversations.insert(thread);
  } catch (threadError) {
    try {
      await repos.intervalBookings.setStatus(booking.id, 'cancelled');
    } catch (compensateError) {
      console.error(
        `[booking] thread insert failed and compensating cancel also failed for ${booking.id}`,
        compensateError,
      );
    }
    console.error(`[booking] thread insert failed for ${booking.id}, booking cancelled`, threadError);
    throw new Error('booking_thread_failed');
  }

  return intervalBookingToUiBooking(
    { booking, items: await repos.intervalBookings.listItems(booking.id) },
    {
      timeZone,
      technician: technician
        ? { id: technician.id, name: technician.name, initials: technician.initials }
        : { id: booking.technicianId, name: 'Technician', initials: '–' },
      merchantName,
      conversationId: threadId,
    },
  );
}
