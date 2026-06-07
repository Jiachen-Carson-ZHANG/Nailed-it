import { calculateEstimate } from '@/domain/pricing';
import type {
  AIRecognitionResult,
  NailStyleCard,
  StyleDiscoveryFacet,
  StylePreviewQuote
} from '@/domain/nail';
import type { LocalizedText } from '@/i18n/types';
import {
  chromeMirrorAIResult,
  dailySolidAIResult,
  mockAIResult,
  softFrenchAIResult
} from './ai';
import { defaultPricingRules } from './pricing';

export type StyleDefinition = Omit<NailStyleCard, 'previewQuote'> & {
  recognition: AIRecognitionResult;
  titleLocalized: LocalizedText;
  descriptionLocalized: LocalizedText;
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
    discoveryFacets: [
      { kind: 'style', label: 'Cat eye' },
      { kind: 'addon', label: 'Rhinestone' },
      { kind: 'mood', label: 'Sweet' }
    ] satisfies StyleDiscoveryFacet[],
    imageUrl:
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80',
    title: 'Rose cat-eye',
    titleLocalized: {
      'zh-CN': '玫瑰猫眼',
      en: 'Rose cat-eye'
    },
    descriptionLocalized: {
      'zh-CN': '玫瑰粉底色搭配柔和磁吸光带，整体像晚霞一样细闪。',
      en: 'Rose-pink nails with a soft magnetic highlight and a delicate sunset shimmer.'
    },
    popularityScore: 96,
    recognition: mockAIResult
  },
  {
    id: 'soft-french',
    discoveryFacets: [
      { kind: 'style', label: 'French' },
      { kind: 'lifestyle', label: 'Commute' },
      { kind: 'mood', label: 'Clean' }
    ] satisfies StyleDiscoveryFacet[],
    imageUrl:
      'https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=900&q=80',
    title: 'Creamy French',
    titleLocalized: {
      'zh-CN': '奶油法式',
      en: 'Creamy French'
    },
    descriptionLocalized: {
      'zh-CN': '奶白底配细法式边，整体温柔干净。',
      en: 'Soft milky nails with a fine French edge and a clean, gentle finish.'
    },
    popularityScore: 90,
    recognition: softFrenchAIResult
  },
  {
    id: 'chrome-mirror',
    discoveryFacets: [
      { kind: 'style', label: 'Chrome' },
      { kind: 'shape', label: 'Almond' },
      { kind: 'lifestyle', label: 'Party' }
    ] satisfies StyleDiscoveryFacet[],
    imageUrl:
      'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=900&q=80',
    title: 'Mirror chrome almond',
    titleLocalized: {
      'zh-CN': '镜面银铬',
      en: 'Mirror chrome almond'
    },
    descriptionLocalized: {
      'zh-CN': '镜面银铬覆盖杏仁甲型，指尖有冷调反光和轻微闪粉过渡。',
      en: 'Mirror chrome over an almond shape with cool-toned reflection and a fine glitter fade.'
    },
    popularityScore: 88,
    recognition: chromeMirrorAIResult
  },
  {
    id: 'minimal-solid',
    discoveryFacets: [
      { kind: 'style', label: 'Solid' },
      { kind: 'mood', label: 'Minimal' },
      { kind: 'lifestyle', label: 'Daily' }
    ] satisfies StyleDiscoveryFacet[],
    imageUrl:
      'https://images.unsplash.com/photo-1599948128020-9a44505b0d1b?auto=format&fit=crop&w=900&q=80',
    title: 'Everyday sheer pink',
    titleLocalized: {
      'zh-CN': '通勤裸粉',
      en: 'Everyday sheer pink'
    },
    descriptionLocalized: {
      'zh-CN': '通透裸粉薄涂，整体干净低调，适合日常通勤。',
      en: 'A sheer nude-pink overlay with a clean, understated finish for everyday wear.'
    },
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
