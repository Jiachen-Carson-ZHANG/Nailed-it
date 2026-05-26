import { beforeEach, describe, expect, it } from 'vitest';
import type { CustomerBookingDraft } from '@/domain/nail';
import { mockAIResult } from './ai';
import { mockBookings } from './bookings';
import {
  createBookingFromDraft,
  getAvailableBookingDays,
  getBookingsSnapshot,
  getConversationForRole,
  getConversationsForRole,
  getConversationThreads,
  reloadOperationsStoreFromStorageForTests,
  resetOperationsStoreForTests
} from './operations-store';

const baseDraft: CustomerBookingDraft = {
  estimate: {
    source: 'pricing_rules',
    price: 123,
    duration: 88
  },
  imageUrl: 'https://example.com/reference.png',
  recognition: mockAIResult
};

describe('operations store', () => {
  beforeEach(() => {
    resetOperationsStoreForTests();
  });

  it('starts from the seeded bookings', () => {
    expect(getBookingsSnapshot()).toHaveLength(mockBookings.length);
  });

  it('creates a confirmed booking from a valid technician slot', () => {
    const slot = getAvailableBookingDays()[0].slots[0];
    const booking = createBookingFromDraft({
      draft: baseDraft,
      notes: 'Prefer a soft pink tone.',
      slot
    });

    expect(booking).toMatchObject({
      customerName: 'Melissa Tan',
      status: 'confirmed',
      date: slot.date,
      time: slot.time,
      technician: slot.technician
    });
    expect(getBookingsSnapshot()).toHaveLength(mockBookings.length + 1);
    expect(getConversationThreads().some((thread) => thread.bookingId === booking.id)).toBe(true);
  });

  it('creates a pending review booking when recognition confidence is low', () => {
    const slot = getAvailableBookingDays()[0].slots[0];
    const booking = createBookingFromDraft({
      draft: {
        ...baseDraft,
        recognition: {
          ...baseDraft.recognition,
          meta: {
            ...baseDraft.recognition.meta,
            confidence: 0.52
          }
        }
      },
      notes: 'Please check this before confirming.',
      slot
    });

    expect(booking.status).toBe('pending_review');
    expect(
      getConversationForRole(booking.conversationId ?? '', 'customer')?.lastMessage
    ).toMatch(/review/i);
  });

  it('creates a pending review booking when recognition confidence is not finite', () => {
    const slot = getAvailableBookingDays()[0].slots[0];
    const booking = createBookingFromDraft({
      draft: {
        ...baseDraft,
        recognition: {
          ...baseDraft.recognition,
          meta: {
            ...baseDraft.recognition.meta,
            confidence: Number.NaN
          }
        }
      },
      notes: 'Unclear confidence should not auto-confirm.',
      slot
    });

    expect(booking.status).toBe('pending_review');
  });

  it('keeps exact-threshold recognition eligible for auto-confirmation', () => {
    const slot = getAvailableBookingDays()[0].slots[0];
    const booking = createBookingFromDraft({
      draft: {
        ...baseDraft,
        recognition: {
          ...baseDraft.recognition,
          meta: {
            ...baseDraft.recognition.meta,
            confidence: 0.75
          }
        }
      },
      notes: 'Threshold confidence can auto-confirm.',
      slot
    });

    expect(booking.status).toBe('confirmed');
  });

  it('shows only the current customer threads to the customer role', () => {
    expect(getConversationsForRole('customer').map((conversation) => conversation.id)).toEqual([
      'conv-melissa'
    ]);
    expect(getConversationsForRole('merchant').map((conversation) => conversation.id)).toEqual([
      'conv-melissa',
      'conv-amy',
      'conv-rachel'
    ]);
  });

  it('blocks the customer role from opening another customer appointment thread', () => {
    expect(getConversationForRole('conv-amy', 'customer')).toBeNull();
    expect(getConversationForRole('conv-amy', 'merchant')?.participantName).toBe('Amy Lim');
  });

  it('adds newly created bookings to the current customer inbox and merchant inbox', () => {
    const slot = getAvailableBookingDays()[0].slots[0];
    const booking = createBookingFromDraft({ draft: baseDraft, notes: '', slot });

    expect(getConversationsForRole('customer').map((conversation) => conversation.id)).toEqual([
      'conv-melissa',
      booking.conversationId
    ]);
    expect(getConversationsForRole('merchant').map((conversation) => conversation.id)).toContain(
      booking.conversationId
    );
  });

  it('hydrates current session bookings and threads from browser storage after reload', () => {
    const slot = getAvailableBookingDays()[0].slots[0];
    const booking = createBookingFromDraft({ draft: baseDraft, notes: 'Keep this after reload.', slot });

    reloadOperationsStoreFromStorageForTests();

    expect(getBookingsSnapshot().some((item) => item.id === booking.id)).toBe(true);
    expect(getConversationForRole(booking.conversationId ?? '', 'customer')?.lastMessage).toMatch(
      /confirmed/i
    );
  });

  it('resets created bookings and conversations back to seeds', () => {
    const slot = getAvailableBookingDays()[0].slots[0];
    createBookingFromDraft({ draft: baseDraft, notes: '', slot });

    expect(getBookingsSnapshot()).toHaveLength(mockBookings.length + 1);

    resetOperationsStoreForTests();

    expect(getBookingsSnapshot()).toHaveLength(mockBookings.length);
  });
});
