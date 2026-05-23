import { describe, expect, it } from 'vitest';
import { calculateEstimate } from './pricing';
import type { AIRecognitionResult, PricingItem } from './nail';

const baseRecognition: AIRecognitionResult = {
  removal: false,
  extension: false,
  builderGel: false,
  nailShape: 'round',
  styles: ['solid'],
  otherNotes: '',
  confidence: 0.86,
  estimatedPrice: 0,
  estimatedDuration: 0
};

const pricingRules: PricingItem[] = [
  { id: 'base-removal', category: 'base', name: 'removal', price: 10, duration: 15, enabled: true },
  { id: 'base-extension', category: 'base', name: 'extension', price: 25, duration: 30, enabled: true },
  { id: 'base-builder-gel', category: 'base', name: 'builderGel', price: 20, duration: 20, enabled: true },
  { id: 'shape-round', category: 'shape', name: 'round', price: 0, duration: 0, enabled: true },
  { id: 'shape-almond', category: 'shape', name: 'almond', price: 5, duration: 5, enabled: true },
  { id: 'style-solid', category: 'style', name: 'solid', price: 30, duration: 40, enabled: true },
  { id: 'style-cat-eye', category: 'style', name: 'catEye', price: 50, duration: 60, enabled: true },
  { id: 'style-rhinestone', category: 'addon', name: 'rhinestone', price: 20, duration: 20, enabled: true }
];

describe('calculateEstimate', () => {
  it('calculates the base estimate from selected style and shape', () => {
    expect(calculateEstimate(baseRecognition, pricingRules)).toEqual({
      price: 30,
      duration: 40
    });
  });

  it('adds enabled base services, shape, style, and add-ons', () => {
    const recognition: AIRecognitionResult = {
      ...baseRecognition,
      removal: true,
      extension: true,
      builderGel: true,
      nailShape: 'almond',
      styles: ['catEye', 'rhinestone']
    };

    expect(calculateEstimate(recognition, pricingRules)).toEqual({
      price: 130,
      duration: 150
    });
  });

  it('ignores disabled pricing rules', () => {
    const rulesWithDisabledAddon = pricingRules.map((item) =>
      item.name === 'rhinestone' ? { ...item, enabled: false } : item
    );
    const recognition: AIRecognitionResult = {
      ...baseRecognition,
      styles: ['solid', 'rhinestone']
    };

    expect(calculateEstimate(recognition, rulesWithDisabledAddon)).toEqual({
      price: 30,
      duration: 40
    });
  });
});
