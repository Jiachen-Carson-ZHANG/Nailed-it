'use server';

import { randomUUID } from 'node:crypto';
import type { TechnicianSlotDay } from '@/domain/availability';
import { calculateEstimate } from '@/domain/pricing';
import type {
  AIRecognitionResult,
  Booking,
  TechnicianSlot,
} from '@/domain/nail';
import { findAvailableTechnicians } from '@/domain/scheduling';
import type { MsInterval } from '@/domain/scheduling';
import type { RepositoryBundle } from '@/lib/repositories';
import { getRepositories } from '@/lib/repositories';
import { createAvailabilityService } from '@/lib/services/availability-service';
import { intervalBookingToUiBooking } from '@/lib/services/booking-adapter';
import { createBookingService } from '@/lib/services/booking-service';
import { instantToZonedParts, resolveSlot } from '@/lib/services/timezone';
import { demoMerchantId } from '@/mock/merchants';
import { demoCustomerName } from '@/mock/customers';

const SLOT_LOOKAHEAD_DAYS = 7;
const CANDIDATE_TIMES = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The next N calendar dates (YYYY-MM-DD) starting from `startDate`, in calendar order. */
function nextDates(startDate: string, count: number): string[] {
  const [y, mo, d] = startDate.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(y, mo - 1, d + i));
    const iso = date.toISOString();
    return iso.slice(0, 10);
  });
}

function dayLabel(date: string, today: string): string {
  const [ty, tmo, td] = today.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(ty, tmo - 1, td + 1)).toISOString().slice(0, 10);
  if (date === today) return 'Today';
  if (date === tomorrow) return 'Tomorrow';
  const [y, mo, d] = date.split('-').map(Number);
  return WEEKDAY_LABELS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
}

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
 * Availability for the confirm-page grid. Uses the real scheduling kernel — working_plan hours +
 * breaks, blocked_time, and existing DB bookings — over the next few days from the merchant's
 * "today", so the grid never offers a past date, a Sunday a closed technician, or an occupied slot.
 */
export async function listAvailableSlotsAction(durationMin: number): Promise<TechnicianSlotDay[]> {
  const repos = getRepositories();
  const merchant = await repos.merchants.getById(demoMerchantId);
  const timeZone = merchant?.timezone ?? 'Asia/Singapore';

  const technicians = (await repos.technicians.list()).filter((t) => t.merchantId === demoMerchantId);
  const [workingPlans, blockedTimes, bookings] = await Promise.all([
    repos.workingPlans.list(),
    repos.blockedTimes.list(),
    repos.intervalBookings.listByMerchant(demoMerchantId),
  ]);

  const existingByTechnician: Record<string, MsInterval[]> = {};
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    (existingByTechnician[b.technicianId] ??= []).push({
      startMs: Date.parse(b.startAt),
      endMs: Date.parse(b.endAt),
    });
  }

  const today = instantToZonedParts(Date.now(), timeZone).date;
  const dates = nextDates(today, SLOT_LOOKAHEAD_DAYS);

  const candidates: TechnicianSlot[] = [];
  for (const date of dates) {
    const label = dayLabel(date, today);
    for (const time of CANDIDATE_TIMES) {
      const request = resolveSlot(timeZone, date, time, durationMin);
      const free = findAvailableTechnicians({
        technicians,
        workingPlans,
        blockedTimes,
        existingByTechnician,
        request,
      });
      for (const technician of free) {
        candidates.push({ date, label, time, technician });
      }
    }
  }

  const ranked = candidates
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time) ||
        a.technician.name.localeCompare(b.technician.name),
    )
    .map((slot, index) => ({
      ...slot,
      rankReason: index === 0 ? ('shortest_wait' as const) : ('earliest_available' as const),
    }));

  return dates
    .map((date) => ({
      date,
      label: dayLabel(date, today),
      slots: ranked.filter((slot) => slot.date === date),
    }))
    .filter((day) => day.slots.length > 0);
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
 * Create a booking + its conversation thread. Identity (customer), money (price/duration), status,
 * and availability are all enforced server-side:
 * - price/duration are recomputed from the recognition via the DB pricing rules;
 * - status is forced to `pending_review` — client recognition (confidence + selections) is
 *   untrusted, so the snapshot bridge never auto-confirms from it; a booking only leaves review
 *   once the recognition/catalog selections are issued server-side (live P6);
 * - the chosen technician is re-checked against the scheduling kernel for the exact slot + duration,
 *   so a tampered request cannot book during a break, blocked time, or outside working hours (the
 *   DB exclusion constraint only stops booking-vs-booking overlap).
 * The browser cannot book a $0, one-minute, auto-confirmed, or off-hours appointment.
 */
export async function createBookingAction(input: CreateBookingActionInput): Promise<Booking> {
  const repos = getRepositories();
  const merchant = await repos.merchants.getById(demoMerchantId);
  const merchantName = merchant?.name ?? 'Nailed-it Studio';
  const timeZone = merchant?.timezone ?? 'Asia/Singapore';

  const customerName = demoCustomerName;
  const pricingRules = await repos.pricing.list();
  const estimate = calculateEstimate(input.recognition, pricingRules);
  // Never trust client recognition to auto-confirm: every snapshot booking goes to merchant review.
  const status: Booking['status'] = 'pending_review';

  // Enforce availability at write time, not only in the displayed grid. Re-derive the available
  // technicians from the kernel for this exact slot + server-recomputed duration and reject if the
  // chosen technician is not among them (breaks / blocked time / outside hours all fail closed).
  const available = await createAvailabilityService(repos).findAvailable({
    merchantId: demoMerchantId,
    date: input.date,
    time: input.time,
    durationMin: estimate.duration,
  });
  if (!available.some((t) => t.id === input.technicianId)) {
    throw new Error('technician_unavailable');
  }

  // Look the technician up before the write so the thread greeting can name them.
  const technician = (await repos.technicians.list()).find((t) => t.id === input.technicianId);
  const technicianName = technician?.name ?? 'your technician';

  // Booking + thread + greeting commit in one transaction (create_booking_with_thread RPC), so
  // there is no orphan booking and no empty thread — no compensating cancel needed.
  const booking = await createBookingService(repos).createBookingWithThreadFromSnapshot(
    {
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
    },
    (created) => ({
      id: `conv-${created.id}`,
      bookingId: created.id,
      customerName,
      merchantName,
      relatedBookingTime: `${input.date} ${input.time}`,
      messages: [
        {
          id: `msg-${randomUUID()}`,
          authorRole: 'system',
          body: `Your appointment is pending merchant review with ${technicianName} at ${input.time}.`,
          sentAt: 'Now',
        },
      ],
    }),
  );

  return intervalBookingToUiBooking(
    { booking, items: await repos.intervalBookings.listItems(booking.id) },
    {
      timeZone,
      technician: technician
        ? { id: technician.id, name: technician.name, initials: technician.initials }
        : { id: booking.technicianId, name: 'Technician', initials: '–' },
      merchantName,
      conversationId: `conv-${booking.id}`,
    },
  );
}
