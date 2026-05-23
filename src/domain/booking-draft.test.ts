import { describe, expect, it } from 'vitest';
import type { AIRecognitionResult } from '@/domain/nail';
import { mockAIResult } from '@/mock/ai';
import {
  clearCustomerBookingDraft,
  consumeCustomerBookingDraft,
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

  it('consumes the draft as a snapshot and invalidates the shared slot afterwards', () => {
    const savedDraft = saveCustomerBookingDraft({
      estimate: {
        source: 'pricing_rules',
        price: 123,
        duration: 88
      },
      imageUrl: 'https://example.com/reference.png',
      recognition: {
        ...mockAIResult,
        selection: {
          ...mockAIResult.selection,
          otherNotes: 'Snapshot boundary note.'
        }
      }
    });

    const consumedDraft = consumeCustomerBookingDraft();

    expect(consumedDraft).toEqual(savedDraft);
    expect(consumedDraft).not.toBe(savedDraft);
    expect(getCustomerBookingDraft()).toBeNull();
    expect(consumeCustomerBookingDraft()).toBeNull();
  });

  it('does not expose shared mutable references through the store boundary', () => {
    const inputDraft = {
      estimate: {
        source: 'pricing_rules' as const,
        price: 123,
        duration: 88
      },
      imageUrl: 'https://example.com/reference.png',
      recognition: {
        ...mockAIResult,
        selection: {
          ...mockAIResult.selection,
          otherNotes: 'Original note.'
        }
      }
    };

    saveCustomerBookingDraft(inputDraft);
    inputDraft.recognition.selection.otherNotes = 'Mutated after save.';

    const firstRead = getCustomerBookingDraft();

    expect(firstRead?.recognition.selection.otherNotes).toBe('Original note.');

    if (!firstRead) {
      throw new Error('Expected draft to exist for snapshot regression test.');
    }

    firstRead.recognition.selection.otherNotes = 'Mutated after read.';

    expect(getCustomerBookingDraft()?.recognition.selection.otherNotes).toBe('Original note.');
  });
});
