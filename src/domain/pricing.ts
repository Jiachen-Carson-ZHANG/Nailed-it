import type {
  AIRecognitionResult,
  AISuggestedQuote,
  BaseServiceName,
  NailAddonName,
  NailStyleName,
  PricingItem,
  RuleBasedQuote
} from './nail';

export function getAiSuggestedQuote(recognition: AIRecognitionResult): AISuggestedQuote {
  return recognition.meta.aiSuggestedQuote;
}

export function calculateEstimate(
  recognition: AIRecognitionResult,
  pricingRules: PricingItem[]
): RuleBasedQuote {
  const { baseServices, nailShape, styles, addons } = recognition.selection;
  const selectedBaseServices = new Set<BaseServiceName>(baseServices);
  const selectedStyles = new Set<NailStyleName>(styles);
  const selectedAddons = new Set<NailAddonName>(addons);

  // 中文注释：不同 category 使用各自的选择集合匹配，避免 style/addon/base 因为同名字符串互相串价。
  return pricingRules.reduce<RuleBasedQuote>(
    (quote, rule) => {
      if (!rule.enabled) {
        return quote;
      }

      const isSelected =
        (rule.category === 'base' && selectedBaseServices.has(rule.target)) ||
        (rule.category === 'shape' && nailShape === rule.target) ||
        (rule.category === 'style' && selectedStyles.has(rule.target)) ||
        (rule.category === 'addon' && selectedAddons.has(rule.target));

      if (!isSelected) {
        return quote;
      }

      return {
        source: 'pricing_rules',
        price: quote.price + rule.price,
        duration: quote.duration + rule.duration
      };
    },
    {
      source: 'pricing_rules',
      price: 0,
      duration: 0
    }
  );
}
