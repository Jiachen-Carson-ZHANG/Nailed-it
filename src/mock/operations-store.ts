import { toConversationForRole } from '@/domain/messaging';
import type {
  Booking,
  BookingConversationThread,
  CustomerBookingDraft,
  MessageAuthorRole,
  TechnicianSlot,
  UserRole
} from '@/domain/nail';
import {
  getAvailableBookingDays as getSeedAvailableBookingDays,
  mockBookings
} from './bookings';
import { seedConversationThreads } from './conversations';

const confidenceReviewThreshold = 0.75;
const merchantName = 'Nailed-it Studio';
const demoCustomerName = 'Carson Lee';

let nextBookingNumber = mockBookings.length + 1;
let nextThreadNumber = seedConversationThreads.length + 1;
let nextMessageNumber = seedConversationThreads.reduce(
  (count, thread) => count + thread.messages.length,
  1
);
let bookingState = cloneBookings(mockBookings);
let threadState = cloneThreads(seedConversationThreads);

export function getBookingsSnapshot(): Booking[] {
  return cloneBookings(bookingState);
}

export function getAvailableBookingDays() {
  return getSeedAvailableBookingDays(bookingState);
}

export function createBookingFromDraft({
  draft,
  notes,
  slot
}: {
  draft: CustomerBookingDraft;
  notes: string;
  slot: TechnicianSlot;
}): Booking {
  const status: Booking['status'] =
    draft.recognition.meta.confidence < confidenceReviewThreshold ? 'pending_review' : 'confirmed';
  const bookingId = `booking-auto-${nextBookingNumber}`;
  const threadId = `conv-auto-${nextThreadNumber}`;
  nextBookingNumber += 1;
  nextThreadNumber += 1;

  const booking: Booking = {
    id: bookingId,
    customerName: demoCustomerName,
    merchantName,
    styleTitle: 'Custom AI reference',
    styleImageUrl: draft.imageUrl,
    date: slot.date,
    time: slot.time,
    quote: {
      source: 'booking_snapshot',
      price: draft.estimate.price,
      duration: draft.estimate.duration
    },
    status,
    technician: { ...slot.technician },
    conversationId: threadId,
    notes,
    recognition: cloneRecognition(draft.recognition)
  };
  const systemBody =
    status === 'confirmed'
      ? `Your appointment is confirmed with ${slot.technician.name} at ${slot.label.toLowerCase()} ${slot.time}.`
      : `Your appointment is pending merchant review with ${slot.technician.name} at ${slot.label.toLowerCase()} ${slot.time}.`;
  const thread: BookingConversationThread = {
    id: threadId,
    bookingId,
    customerName: demoCustomerName,
    merchantName,
    relatedBookingTime: `${slot.label} ${slot.time}`,
    messages: [
      {
        id: `msg-auto-${nextMessageNumber}`,
        authorRole: 'system',
        body: systemBody,
        sentAt: 'Now'
      }
    ]
  };
  nextMessageNumber += 1;
  bookingState = [...bookingState, booking];
  threadState = [...threadState, thread];

  return cloneBooking(booking);
}

export function getConversationThreads(): BookingConversationThread[] {
  return cloneThreads(threadState);
}

export function getConversationForRole(conversationId: string, role: UserRole) {
  const thread = threadState.find((item) => item.id === conversationId);

  return thread ? toConversationForRole(thread, role) : null;
}

export function getConversationsForRole(role: UserRole) {
  return threadState.map((thread) => toConversationForRole(thread, role));
}

export function sendMessage({
  authorRole,
  body,
  conversationId
}: {
  authorRole: MessageAuthorRole;
  body: string;
  conversationId: string;
}): BookingConversationThread | null {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    return null;
  }

  const thread = threadState.find((item) => item.id === conversationId);

  if (!thread) {
    return null;
  }

  const updatedThread: BookingConversationThread = {
    ...thread,
    messages: [
      ...thread.messages,
      {
        id: `msg-auto-${nextMessageNumber}`,
        authorRole,
        body: trimmedBody,
        sentAt: 'Now'
      }
    ]
  };
  nextMessageNumber += 1;
  threadState = threadState.map((item) => (item.id === conversationId ? updatedThread : item));

  return cloneThread(updatedThread);
}

export function resetOperationsStoreForTests() {
  nextBookingNumber = mockBookings.length + 1;
  nextThreadNumber = seedConversationThreads.length + 1;
  nextMessageNumber = seedConversationThreads.reduce(
    (count, thread) => count + thread.messages.length,
    1
  );
  bookingState = cloneBookings(mockBookings);
  threadState = cloneThreads(seedConversationThreads);
}

function cloneBookings(bookings: Booking[]) {
  return bookings.map(cloneBooking);
}

function cloneBooking(booking: Booking): Booking {
  return {
    ...booking,
    quote: { ...booking.quote },
    technician: { ...booking.technician },
    recognition: cloneRecognition(booking.recognition)
  };
}

function cloneRecognition(recognition: Booking['recognition']) {
  return {
    selection: {
      baseServices: [...recognition.selection.baseServices],
      nailShape: recognition.selection.nailShape,
      styles: [...recognition.selection.styles],
      addons: [...recognition.selection.addons],
      otherNotes: recognition.selection.otherNotes
    },
    meta: {
      confidence: recognition.meta.confidence,
      aiSuggestedQuote: { ...recognition.meta.aiSuggestedQuote }
    }
  };
}

function cloneThreads(threads: BookingConversationThread[]) {
  return threads.map(cloneThread);
}

function cloneThread(thread: BookingConversationThread): BookingConversationThread {
  return {
    ...thread,
    messages: thread.messages.map((message) => ({ ...message }))
  };
}
