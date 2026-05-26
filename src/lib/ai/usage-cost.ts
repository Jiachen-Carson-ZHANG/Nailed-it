export type VisionTokenUsage = {
  cachedContentTokenCount: number;
  candidatesTokenCount: number;
  promptTokenCount: number;
  serviceTier?: string;
  thoughtsTokenCount: number;
  toolUsePromptTokenCount: number;
  totalTokenCount: number;
};

export type VisionTokenPricing = {
  inputUsdPer1MTokens: number;
  outputUsdPer1MTokens: number;
};

export type VisionCostEstimate = VisionTokenPricing & {
  currency: 'USD';
  inputTokens: number;
  inputUsd: number;
  outputTokens: number;
  outputUsd: number;
  totalTokens: number;
  totalUsd: number;
};

export type VisionUsageLogEvent = {
  costEstimate: VisionCostEstimate | null;
  model: string;
  provider: string;
  status: 'success';
  usage: VisionTokenUsage | null;
};

export const defaultVisionTokenPricing: VisionTokenPricing = {
  inputUsdPer1MTokens: 0.1,
  outputUsdPer1MTokens: 0.4
};

export function estimateVisionUsageCost(
  usage: Partial<VisionTokenUsage>,
  pricing: VisionTokenPricing
): VisionCostEstimate {
  const inputTokens =
    toNonNegativeInteger(usage.promptTokenCount) +
    toNonNegativeInteger(usage.toolUsePromptTokenCount);
  const outputTokens =
    toNonNegativeInteger(usage.candidatesTokenCount) +
    toNonNegativeInteger(usage.thoughtsTokenCount);
  const inputUsd = (inputTokens * pricing.inputUsdPer1MTokens) / 1_000_000;
  const outputUsd = (outputTokens * pricing.outputUsdPer1MTokens) / 1_000_000;

  return {
    ...pricing,
    currency: 'USD',
    inputTokens,
    inputUsd,
    outputTokens,
    outputUsd,
    totalTokens: toNonNegativeInteger(usage.totalTokenCount),
    totalUsd: inputUsd + outputUsd
  };
}

export function parseGeminiUsageMetadata(responseJson: unknown): VisionTokenUsage | null {
  const response = asRecord(responseJson);
  const usage = asRecord(response.usageMetadata);

  if (Object.keys(usage).length === 0) {
    return null;
  }

  return {
    promptTokenCount: toNonNegativeInteger(usage.promptTokenCount),
    cachedContentTokenCount: toNonNegativeInteger(usage.cachedContentTokenCount),
    candidatesTokenCount: toNonNegativeInteger(usage.candidatesTokenCount),
    toolUsePromptTokenCount: toNonNegativeInteger(usage.toolUsePromptTokenCount),
    thoughtsTokenCount: toNonNegativeInteger(usage.thoughtsTokenCount),
    totalTokenCount: toNonNegativeInteger(usage.totalTokenCount),
    serviceTier: typeof usage.serviceTier === 'string' ? usage.serviceTier : undefined
  };
}

export function getVisionTokenPricingFromEnv(env: Record<string, string | undefined>): VisionTokenPricing {
  return {
    inputUsdPer1MTokens: getPositiveNumber(
      env.VISION_INPUT_PRICE_PER_1M_TOKENS,
      defaultVisionTokenPricing.inputUsdPer1MTokens
    ),
    outputUsdPer1MTokens: getPositiveNumber(
      env.VISION_OUTPUT_PRICE_PER_1M_TOKENS,
      defaultVisionTokenPricing.outputUsdPer1MTokens
    )
  };
}

export function shouldLogVisionCost(env: Record<string, string | undefined>): boolean {
  return env.VISION_COST_LOGGING_ENABLED !== 'false';
}

export function createVisionUsageLogEvent(event: VisionUsageLogEvent) {
  return {
    event: 'vision_model_usage',
    provider: event.provider,
    model: event.model,
    status: event.status,
    promptTokenCount: event.usage?.promptTokenCount ?? null,
    candidatesTokenCount: event.usage?.candidatesTokenCount ?? null,
    thoughtsTokenCount: event.usage?.thoughtsTokenCount ?? null,
    totalTokenCount: event.usage?.totalTokenCount ?? null,
    inputTokens: event.costEstimate?.inputTokens ?? null,
    outputTokens: event.costEstimate?.outputTokens ?? null,
    estimatedUsd: event.costEstimate ? roundUsd(event.costEstimate.totalUsd) : null,
    serviceTier: event.usage?.serviceTier ?? null
  };
}

function getPositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
