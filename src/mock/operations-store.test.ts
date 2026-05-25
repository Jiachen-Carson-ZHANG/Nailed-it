import { beforeEach, describe, expect, it } from 'vitest';
import type { CustomerBookingDraft } from '@/domain/nail';
import { mockAIResult } from './ai';
import { mockBookings } from './bookings';
import {
  createBookingFromDraft,
  getAvailableBookingDays,
  getBookingsSnapshot,
  getConversationForRole,
  getConversationThreads,
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

  it('resets created bookings and conversations back to seeds', () => {
    const slot = getAvailableBookingDays()[0].slots[0];
    createBookingFromDraft({ draft: baseDraft, notes: '', slot });

    expect(getBookingsSnapshot()).toHaveLength(mockBookings.length + 1);

    resetOperationsStoreForTests();

    expect(getBookingsSnapshot()).toHaveLength(mockBookings.length);
  });
});
