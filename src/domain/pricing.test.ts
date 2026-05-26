import { describe, expect, it } from 'vitest';
import { calculateEstimate, getAiSuggestedQuote } from './pricing';
import type { AIRecognitionResult, BookingQuote, PricingItem, StylePreviewQuote } from './nail';

const baseRecognition: AIRecognitionResult = {
  selection: {
    baseServices: [],
    nailShape: 'round',
    styles: ['solid'],
    addons: [],
    otherNotes: ''
  },
  meta: {
    confidence: 0.86,
    aiSuggestedQuote: {
      source: 'ai_suggestion',
      price: 0,
      duration: 0
    }
  }
};

const pricingRules: PricingItem[] = [
  { id: 'base-removal', category: 'base', target: 'removal', price: 10, duration: 15, enabled: true },
  { id: 'base-extension', category: 'base', target: 'extension', price: 25, duration: 30, enabled: true },
  { id: 'base-builder-gel', category: 'base', target: 'builderGel', price: 20, duration: 20, enabled: true },
  { id: 'shape-round', category: 'shape', target: 'round', price: 0, duration: 0, enabled: true },
  { id: 'shape-almond', category: 'shape', target: 'almond', price: 5, duration: 5, enabled: true },
  { id: 'style-solid', category: 'style', target: 'solid', price: 30, duration: 40, enabled: true },
  { id: 'style-cat-eye', category: 'style', target: 'catEye', price: 50, duration: 60, enabled: true },
  { id: 'style-rhinestone', category: 'style', target: 'rhinestone', price: 35, duration: 45, enabled: true },
  { id: 'addon-rhinestone', category: 'addon', target: 'rhinestone', price: 20, duration: 20, enabled: true }
];

describe('calculateEstimate', () => {
  it('calculates the base estimate from selected style and shape', () => {
    expect(calculateEstimate(baseRecognition, pricingRules)).toEqual({
      source: 'pricing_rules',
      price: 30,
      duration: 40
    });
  });

  it('adds enabled base services, shape, style, and add-ons', () => {
    const recognition: AIRecognitionResult = {
      ...baseRecognition,
      selection: {
        ...baseRecognition.selection,
        baseServices: ['removal', 'extension', 'builderGel'],
        nailShape: 'almond',
        styles: ['catEye'],
        addons: ['rhinestone']
      }
    };

    expect(calculateEstimate(recognition, pricingRules)).toEqual({
      source: 'pricing_rules',
      price: 130,
      duration: 150
    });
  });

  it('ignores disabled pricing rules', () => {
    const rulesWithDisabledAddon = pricingRules.map((item) =>
      item.category === 'addon' && item.target === 'rhinestone' ? { ...item, enabled: false } : item
    );
    const recognition: AIRecognitionResult = {
      ...baseRecognition,
      selection: {
        ...baseRecognition.selection,
        styles: ['solid'],
        addons: ['rhinestone']
      }
    };

    expect(calculateEstimate(recognition, rulesWithDisabledAddon)).toEqual({
      source: 'pricing_rules',
      price: 30,
      duration: 40
    });
  });

  it('does not charge add-on rules when only a same-named style is selected', () => {
    const recognition: AIRecognitionResult = {
      ...baseRecognition,
      selection: {
        ...baseRecognition.selection,
        styles: ['rhinestone'],
        addons: []
      }
    };

    expect(calculateEstimate(recognition, pricingRules)).toEqual({
      source: 'pricing_rules',
      price: 35,
      duration: 45
    });
  });

  it('returns a zero estimate when no pricing rules are active', () => {
    expect(calculateEstimate(baseRecognition, [])).toEqual({
      source: 'pricing_rules',
      price: 0,
      duration: 0
    });
  });

  it('keeps AI, preview, rule-based, and booking snapshot quotes separate', () => {
    const aiSuggestedQuote = getAiSuggestedQuote(baseRecognition);
    const ruleBasedQuote = calculateEstimate(baseRecognition, pricingRules);
    const previewQuote: StylePreviewQuote = {
      source: 'style_preview',
      price: 30,
      duration: 40
    };
    const bookingSnapshotQuote: BookingQuote = {
      source: 'booking_snapshot',
      price: 30,
      duration: 40
    };

    expect(aiSuggestedQuote).toEqual({
      source: 'ai_suggestion',
      price: 0,
      duration: 0
    });
    expect(ruleBasedQuote.source).toBe('pricing_rules');
    expect(previewQuote.source).toBe('style_preview');
    expect(bookingSnapshotQuote.source).toBe('booking_snapshot');
    expect(aiSuggestedQuote.source).not.toBe(ruleBasedQuote.source);
    expect(aiSuggestedQuote.source).not.toBe(previewQuote.source);
    expect(aiSuggestedQuote.source).not.toBe(bookingSnapshotQuote.source);
    expect(ruleBasedQuote.source).not.toBe(previewQuote.source);
    expect(ruleBasedQuote.source).not.toBe(bookingSnapshotQuote.source);
    expect(previewQuote.source).not.toBe(bookingSnapshotQuote.source);
  });
});
