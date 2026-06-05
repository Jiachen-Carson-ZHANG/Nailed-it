'use server';

import { randomUUID } from 'node:crypto';
import type { Booking, BookingConversationThread } from '@/domain/nail';
import { getRepositories } from '@/lib/repositories';
import { intervalBookingToUiBooking } from '@/lib/services/booking-adapter';
import { createBookingService } from '@/lib/services/booking-service';
import { demoMerchantId } from '@/mock/merchants';

export type CreateBookingActionInput = {
  technicianId: string;
  customerName: string;
  styleTitle: string;
  styleImageUrl: string;
  date: string;
  time: string;
  estimate: { price: number; duration: number };
  // The confirm page derives this from the recognition confidence (requiresMerchantReview).
  status: 'confirmed' | 'pending_review';
  notes: string;
};

/**
 * P4d read path: all of the demo merchant's bookings, adapted to the flat UI Booking shape the
 * reader surfaces (calendar, profile, booking detail) render. N+1 on items is fine at demo scale.
 */
export async function listBookingViewsAction(): Promise<Booking[]> {
  const repos = getRepositories();
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

/**
 * P4d write path: create the interval booking (via the snapshot bridge) and its linked
 * conversation thread in the DB, in place of the old localStorage createBookingFromDraft.
 * Returns the flat UI Booking shape the confirm page already renders.
 */
export async function createBookingAction(input: CreateBookingActionInput): Promise<Booking> {
  const repos = getRepositories();
  const merchant = await repos.merchants.getById(demoMerchantId);
  const merchantName = merchant?.name ?? 'Nailed-it Studio';
  const timeZone = merchant?.timezone ?? 'Asia/Singapore';

  const booking = await createBookingService(repos).createBookingFromSnapshot({
    merchantId: demoMerchantId,
    technicianId: input.technicianId,
    customerName: input.customerName,
    styleTitle: input.styleTitle,
    styleImageUrl: input.styleImageUrl,
    date: input.date,
    time: input.time,
    estimate: input.estimate,
    status: input.status,
    notes: input.notes,
  });

  const technician = (await repos.technicians.list()).find((t) => t.id === booking.technicianId);
  const technicianName = technician?.name ?? 'your technician';

  const threadId = `conv-${booking.id}`;
  const thread: BookingConversationThread = {
    id: threadId,
    bookingId: booking.id,
    customerName: input.customerName,
    merchantName,
    relatedBookingTime: `${input.date} ${input.time}`,
    messages: [
      {
        id: `msg-${randomUUID()}`,
        authorRole: 'system',
        body:
          input.status === 'confirmed'
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
