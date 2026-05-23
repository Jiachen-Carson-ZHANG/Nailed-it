import { calculateEstimate } from '@/domain/pricing';
import type { AIRecognitionResult, NailStyleCard, StylePreviewQuote } from '@/domain/nail';
import {
  chromeMirrorAIResult,
  dailySolidAIResult,
  mockAIResult,
  softFrenchAIResult
} from './ai';
import { defaultPricingRules } from './pricing';

export type StyleDefinition = Omit<NailStyleCard, 'previewQuote'> & {
  recognition: AIRecognitionResult;
};

function createPreviewQuoteForRules(
  recognition: AIRecognitionResult,
  pricingRules = defaultPricingRules
): StylePreviewQuote {
  const quote = calculateEstimate(recognition, pricingRules);

  return {
    source: 'style_preview',
    price: quote.price,
    duration: quote.duration
  };
}

function createStyleCard(style: StyleDefinition, pricingRules = defaultPricingRules): NailStyleCard {
  const { recognition, ...card } = style;

  return {
    ...card,
    previewQuote: createPreviewQuoteForRules(recognition, pricingRules)
  };
}

export const styleDefinitions: StyleDefinition[] = [
  {
    id: 'rose-cat-eye',
    imageUrl:
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80',
    title: 'Rose Cat Eye Shine',
    tags: ['catEye', 'rhinestone', 'sweet'],
    popularityScore: 96,
    recognition: mockAIResult
  },
  {
    id: 'soft-french',
    imageUrl:
      'https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=900&q=80',
    title: 'Soft Studio French',
    tags: ['french', 'commute', 'clean'],
    popularityScore: 90,
    recognition: softFrenchAIResult
  },
  {
    id: 'chrome-mirror',
    imageUrl:
      'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=900&q=80',
    title: 'Chrome Mirror Almond',
    tags: ['chrome', 'almond', 'party'],
    popularityScore: 88,
    recognition: chromeMirrorAIResult
  },
  {
    id: 'minimal-solid',
    imageUrl:
      'https://images.unsplash.com/photo-1599948128020-9a44505b0d1b?auto=format&fit=crop&w=900&q=80',
    title: 'Clean Daily Solid',
    tags: ['solid', 'minimal', 'daily'],
    popularityScore: 82,
    recognition: dailySolidAIResult
  }
];

export function getStyleDefinitionById(id: string): StyleDefinition | undefined {
  return styleDefinitions.find((style) => style.id === id);
}

export function getTrendingStyles(pricingRules = defaultPricingRules): NailStyleCard[] {
  return styleDefinitions.map((style) => createStyleCard(style, pricingRules));
}

export function findStyleById(
  id: string,
  pricingRules = defaultPricingRules
): NailStyleCard | undefined {
  const style = getStyleDefinitionById(id);

  return style ? createStyleCard(style, pricingRules) : undefined;
}
