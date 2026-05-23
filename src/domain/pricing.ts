import type { AIRecognitionResult, PricingItem } from './nail';

export type PriceEstimate = {
  price: number;
  duration: number;
};

const baseServiceNames: Array<
  keyof Pick<AIRecognitionResult, 'removal' | 'extension' | 'builderGel'>
> = ['removal', 'extension', 'builderGel'];

export function calculateEstimate(
  recognition: AIRecognitionResult,
  pricingRules: PricingItem[]
): PriceEstimate {
  const enabledRules = pricingRules.filter((rule) => rule.enabled);
  const selectedNames = new Set<string>();

  // 中文注释：先把识别结果里被勾选的基础服务提取出来，后续统一和 shape/style 规则做匹配。
  for (const serviceName of baseServiceNames) {
    if (recognition[serviceName]) {
      selectedNames.add(serviceName);
    }
  }

  selectedNames.add(recognition.nailShape);

  for (const styleName of recognition.styles) {
    selectedNames.add(styleName);
  }

  // 中文注释：这里只聚合已启用且命中的规则，避免把禁用项或未选择项混进估价结果。
  return enabledRules.reduce<PriceEstimate>(
    (estimate, rule) => {
      if (!selectedNames.has(rule.name)) {
        return estimate;
      }

      return {
        price: estimate.price + rule.price,
        duration: estimate.duration + rule.duration
      };
    },
    { price: 0, duration: 0 }
  );
}
