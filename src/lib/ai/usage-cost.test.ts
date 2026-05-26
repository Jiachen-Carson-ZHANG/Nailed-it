import { describe, expect, it } from 'vitest';
import {
  estimateVisionUsageCost,
  getVisionTokenPricingFromEnv,
  parseGeminiUsageMetadata
} from './usage-cost';

describe('estimateVisionUsageCost', () => {
  it('calculates per-request cost from input and output token rates', () => {
    const estimate = estimateVisionUsageCost(
      {
        promptTokenCount: 1_000,
        candidatesTokenCount: 150,
        thoughtsTokenCount: 25,
        totalTokenCount: 1_175
      },
      {
        inputUsdPer1MTokens: 0.1,
        outputUsdPer1MTokens: 0.4
      }
    );

    expect(estimate.inputTokens).toBe(1_000);
    expect(estimate.outputTokens).toBe(175);
    expect(estimate.inputUsd).toBeCloseTo(0.0001);
    expect(estimate.outputUsd).toBeCloseTo(0.00007);
    expect(estimate.totalUsd).toBeCloseTo(0.00017);
  });
});

describe('parseGeminiUsageMetadata', () => {
  it('normalizes usage metadata and ignores invalid token counts', () => {
    expect(
      parseGeminiUsageMetadata({
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 20,
          thoughtsTokenCount: -5,
          totalTokenCount: 120,
          serviceTier: 'STANDARD'
        }
      })
    ).toEqual({
      promptTokenCount: 100,
      cachedContentTokenCount: 0,
      candidatesTokenCount: 20,
      toolUsePromptTokenCount: 0,
      thoughtsTokenCount: 0,
      totalTokenCount: 120,
      serviceTier: 'STANDARD'
    });
  });
});

describe('getVisionTokenPricingFromEnv', () => {
  it('uses env pricing overrides when provided', () => {
    expect(
      getVisionTokenPricingFromEnv({
        VISION_INPUT_PRICE_PER_1M_TOKENS: '0.25',
        VISION_OUTPUT_PRICE_PER_1M_TOKENS: '1.5'
      })
    ).toEqual({
      inputUsdPer1MTokens: 0.25,
      outputUsdPer1MTokens: 1.5
    });
  });
});
