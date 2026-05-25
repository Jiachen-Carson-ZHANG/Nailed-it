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
export const demoCustomerName = 'Melissa Tan';
const operationsStorageKey = 'nailed-it.operations-store.v1';

type PersistedOperationsStore = {
  bookingState: Booking[];
  nextBookingNumber: number;
  nextMessageNumber: number;
  nextThreadNumber: number;
  threadState: BookingConversationThread[];
  version: 1;
};

let nextBookingNumber = mockBookings.length + 1;
let nextThreadNumber = seedConversationThreads.length + 1;
let nextMessageNumber = seedConversationThreads.reduce(
  (count, thread) => count + thread.messages.length,
  1
);
let hasHydratedOperationsStore = false;
let bookingState = cloneBookings(mockBookings);
let threadState = cloneThreads(seedConversationThreads);

export function getBookingsSnapshot(): Booking[] {
  ensureHydratedOperationsStore();

  return cloneBookings(bookingState);
}

export function getAvailableBookingDays() {
  ensureHydratedOperationsStore();

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
  ensureHydratedOperationsStore();

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
  persistOperationsStore();

  return cloneBooking(booking);
}

export function getConversationThreads(): BookingConversationThread[] {
  ensureHydratedOperationsStore();

  return cloneThreads(threadState);
}

export function getConversationForRole(conversationId: string, role: UserRole) {
  ensureHydratedOperationsStore();

  const thread = threadState.find((item) => item.id === conversationId);

  return thread && canRoleViewThread(thread, role) ? toConversationForRole(thread, role) : null;
}

export function getConversationsForRole(role: UserRole) {
  ensureHydratedOperationsStore();

  return threadState
    .filter((thread) => canRoleViewThread(thread, role))
    .map((thread) => toConversationForRole(thread, role));
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
  ensureHydratedOperationsStore();

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
  persistOperationsStore();

  return cloneThread(updatedThread);
}

export function resetOperationsStoreForTests() {
  resetInMemoryOperationsStore();
  hasHydratedOperationsStore = true;
  clearPersistedOperationsStore();
}

export function reloadOperationsStoreFromStorageForTests() {
  resetInMemoryOperationsStore();
  hasHydratedOperationsStore = false;
}

function resetInMemoryOperationsStore() {
  nextBookingNumber = mockBookings.length + 1;
  nextThreadNumber = seedConversationThreads.length + 1;
  nextMessageNumber = seedConversationThreads.reduce(
    (count, thread) => count + thread.messages.length,
    1
  );
  bookingState = cloneBookings(mockBookings);
  threadState = cloneThreads(seedConversationThreads);
}

function ensureHydratedOperationsStore() {
  if (hasHydratedOperationsStore) {
    return;
  }

  hasHydratedOperationsStore = true;

  const storage = getOperationsStorage();

  if (!storage) {
    return;
  }

  const rawSnapshot = storage.getItem(operationsStorageKey);

  if (!rawSnapshot) {
    return;
  }

  try {
    const parsedSnapshot: unknown = JSON.parse(rawSnapshot);

    if (!isPersistedOperationsStore(parsedSnapshot)) {
      storage.removeItem(operationsStorageKey);
      return;
    }

    nextBookingNumber = parsedSnapshot.nextBookingNumber;
    nextThreadNumber = parsedSnapshot.nextThreadNumber;
    nextMessageNumber = parsedSnapshot.nextMessageNumber;
    bookingState = cloneBookings(parsedSnapshot.bookingState);
    threadState = cloneThreads(parsedSnapshot.threadState);
  } catch (error) {
    console.warn('Unable to hydrate Nailed-it operations store from browser storage.', error);
    storage.removeItem(operationsStorageKey);
  }
}

function persistOperationsStore() {
  const storage = getOperationsStorage();

  if (!storage) {
    return;
  }

  const snapshot: PersistedOperationsStore = {
    bookingState,
    nextBookingNumber,
    nextMessageNumber,
    nextThreadNumber,
    threadState,
    version: 1
  };

  try {
    storage.setItem(operationsStorageKey, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('Unable to persist Nailed-it operations store to browser storage.', error);
  }
}

function clearPersistedOperationsStore() {
  const storage = getOperationsStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(operationsStorageKey);
}

function getOperationsStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isPersistedOperationsStore(value: unknown): value is PersistedOperationsStore {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const snapshot = value as Partial<PersistedOperationsStore>;

  return (
    snapshot.version === 1 &&
    Array.isArray(snapshot.bookingState) &&
    Array.isArray(snapshot.threadState) &&
    typeof snapshot.nextBookingNumber === 'number' &&
    typeof snapshot.nextThreadNumber === 'number' &&
    typeof snapshot.nextMessageNumber === 'number'
  );
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

function canRoleViewThread(thread: BookingConversationThread, role: UserRole) {
  return role === 'merchant' || thread.customerName === demoCustomerName;
}

function cloneThread(thread: BookingConversationThread): BookingConversationThread {
  return {
    ...thread,
    messages: thread.messages.map((message) => ({ ...message }))
  };
}
