import { describe, expect, it } from 'vitest';
import type { AIRecognitionResult } from '@/domain/nail';
import { mockAIResult } from '@/mock/ai';
import {
  clearCustomerBookingDraft,
  getCustomerBookingDraft,
  saveCustomerBookingDraft
} from './booking-draft';

describe('customer booking draft store', () => {
  it('keeps the latest in-memory booking draft until cleared', () => {
    const nextRecognition: AIRecognitionResult = {
      ...mockAIResult,
      selection: {
        ...mockAIResult.selection,
        otherNotes: 'Edited note for continuity testing.'
      }
    };

    clearCustomerBookingDraft();
    expect(getCustomerBookingDraft()).toBeNull();

    saveCustomerBookingDraft({
      estimate: {
        source: 'pricing_rules',
        price: 123,
        duration: 88
      },
      imageUrl: 'https://example.com/reference.png',
      recognition: nextRecognition
    });

    expect(getCustomerBookingDraft()).toMatchObject({
      estimate: { price: 123, duration: 88 },
      imageUrl: 'https://example.com/reference.png',
      recognition: {
        selection: {
          otherNotes: 'Edited note for continuity testing.'
        }
      }
    });

    clearCustomerBookingDraft();
    expect(getCustomerBookingDraft()).toBeNull();
  });
});
