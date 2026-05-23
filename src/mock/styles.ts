import { calculateEstimate } from '@/domain/pricing';
import type { AIRecognitionResult, NailStyleCard, StylePreviewQuote } from '@/domain/nail';
import {
  chromeMirrorAIResult,
  dailySolidAIResult,
  mockAIResult,
  softFrenchAIResult
} from './ai';
import { defaultPricingRules } from './pricing';

function createPreviewQuote(recognition: AIRecognitionResult): StylePreviewQuote {
  const quote = calculateEstimate(recognition, defaultPricingRules);

  return {
    source: 'style_preview',
    price: quote.price,
    duration: quote.duration
  };
}

function createStyleCard(
  style: Omit<NailStyleCard, 'previewQuote'>,
  recognition: AIRecognitionResult
): NailStyleCard {
  return {
    ...style,
    previewQuote: createPreviewQuote(recognition)
  };
}

export const trendingStyles: NailStyleCard[] = [
  createStyleCard(
    {
      id: 'rose-cat-eye',
      imageUrl:
        'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80',
      title: 'Rose Cat Eye Shine',
      tags: ['catEye', 'rhinestone', 'sweet'],
      popularityScore: 96
    },
    mockAIResult
  ),
  createStyleCard(
    {
      id: 'soft-french',
      imageUrl:
        'https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=900&q=80',
      title: 'Soft Studio French',
      tags: ['french', 'commute', 'clean'],
      popularityScore: 90
    },
    softFrenchAIResult
  ),
  createStyleCard(
    {
      id: 'chrome-mirror',
      imageUrl:
        'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=900&q=80',
      title: 'Chrome Mirror Almond',
      tags: ['chrome', 'almond', 'party'],
      popularityScore: 88
    },
    chromeMirrorAIResult
  ),
  createStyleCard(
    {
      id: 'minimal-solid',
      imageUrl:
        'https://images.unsplash.com/photo-1599948128020-9a44505b0d1b?auto=format&fit=crop&w=900&q=80',
      title: 'Clean Daily Solid',
      tags: ['solid', 'minimal', 'daily'],
      popularityScore: 82
    },
    dailySolidAIResult
  )
];

export function findStyleById(id: string): NailStyleCard | undefined {
  return trendingStyles.find((style) => style.id === id);
}
