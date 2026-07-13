// Grounded AI narration for the merchant insights dashboard (ADR-0006). The AI may ONLY restate /
// interpret pre-computed metrics — it never sees raw events and is told never to invent numbers and
// to say "数据不足" / "insufficient data" when a metric is weak. If the model is unavailable or
// returns junk, a deterministic fallback narrates the same numbers, so the card is always grounded.

import type { AppLanguage } from '@/i18n/types';
import { defaultTryOnModel } from './try-on';
import {
  asRecord,
  extractTextContent,
  postOpenRouterChat,
  stripJsonFence,
  type OpenRouterPayload,
} from './openrouter';
import type { MerchantInsights } from '@/domain/intelligence';
import { fallbackSummary, type AISummary } from './insights-fallback';

// Re-exported so existing importers (`@/nail-ai/insights-summary`) keep working; the deterministic
// baseline now lives in the client-safe `insights-fallback` module.
export { fallbackSummary, type AISummary };

type PostChat = typeof postOpenRouterChat;

export type SummarizeOptions = {
  env?: NodeJS.ProcessEnv;
  postChat?: PostChat;
  language?: AppLanguage;
};

function directionArrow(direction: 'up' | 'down' | 'flat'): string {
  return direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
}

/** A compact, factual brief of the computed metrics — the ONLY thing the model is given. */
export function buildInsightsBrief(insights: MerchantInsights, language: AppLanguage = 'zh-CN'): string {
  const s = insights.snapshot;

  if (language === 'en') {
    const lines: string[] = [
      `Snapshot (last ${s.rangeDays} days): ${s.tryOns} try-ons, ${s.bookings} bookings, ${s.searches} searches, ${s.activeCustomers} active customers.`,
    ];
    const trends = insights.demandTrends.slice(0, 5).map(
      (t) => `${t.label} this week ${t.current}/last week ${t.previous} (${directionArrow(t.direction)})`,
    );
    lines.push(`Demand trends: ${trends.length ? trends.join(', ') : 'insufficient data'}.`);

    const low = insights.designPerformance.highInterestLowConversion[0];
    lines.push(
      `High interest, low conversion: ${low ? `${low.title} — ${low.tryOns} try-ons but only ${low.bookings} bookings` : 'none'}.`,
    );

    const top = insights.designPerformance.styles
      .filter((x) => x.conversionRate !== null)
      .sort((a, b) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0))[0];
    lines.push(
      `Top converter: ${top ? `${top.title} (${top.tryOns} try-ons / ${top.bookings} bookings)` : 'insufficient data'}.`,
    );

    const gap = insights.catalogGaps[0];
    lines.push(
      `Catalog gap: ${gap ? `customers searched "${gap.label}" ${gap.searchCount} times but only ${gap.matchingActiveStyles} live styles` : 'no clear gap'}.`,
    );

    return lines.join('\n');
  }

  const lines: string[] = [
    `本周快照（近${s.rangeDays}天）：试戴 ${s.tryOns}，预订 ${s.bookings}，搜索 ${s.searches}，活跃顾客 ${s.activeCustomers}。`,
  ];

  const trends = insights.demandTrends.slice(0, 5).map(
    (t) => `${t.label} 本周${t.current}/上周${t.previous}（${directionArrow(t.direction)}）`,
  );
  lines.push(`需求趋势：${trends.length ? trends.join('，') : '数据不足'}。`);

  const low = insights.designPerformance.highInterestLowConversion[0];
  lines.push(`高意向低转化：${low ? `${low.title} 试戴${low.tryOns}次但仅${low.bookings}次预订` : '无'}。`);

  const top = insights.designPerformance.styles
    .filter((x) => x.conversionRate !== null)
    .sort((a, b) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0))[0];
  lines.push(`转化最高：${top ? `${top.title}（试戴${top.tryOns}/预订${top.bookings}）` : '数据不足'}。`);

  const gap = insights.catalogGaps[0];
  lines.push(`品类缺口：${gap ? `顾客搜索"${gap.label}" ${gap.searchCount}次，但在售仅${gap.matchingActiveStyles}款` : '无明显缺口'}。`);

  return lines.join('\n');
}

const responseFormat = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'insights_summary',
    strict: true as const,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        headline: { type: 'string' },
        insights: { type: 'array', items: { type: 'string' }, maxItems: 3 },
        actions: { type: 'array', items: { type: 'string' }, maxItems: 2 },
      },
      required: ['headline', 'insights', 'actions'],
    },
  },
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('insights_summary_timeout')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function parseAISummary(raw: string): Omit<AISummary, 'source'> | null {
  try {
    const parsed = asRecord(JSON.parse(stripJsonFence(raw)));
    const headline = typeof parsed.headline === 'string' ? parsed.headline : '';
    const insights = Array.isArray(parsed.insights) ? parsed.insights.filter((x): x is string => typeof x === 'string') : [];
    const actions = Array.isArray(parsed.actions) ? parsed.actions.filter((x): x is string => typeof x === 'string') : [];
    if (!headline) return null;
    return { headline, insights: insights.slice(0, 3), actions: actions.slice(0, 2) };
  } catch {
    return null;
  }
}

const systemPrompts: Record<AppLanguage, string> = {
  'zh-CN':
    '你是美甲店的经营分析助手。只能依据给定的"已计算指标"进行解读，严禁编造或推算任何数字、款式名或事实。' +
    '若某项指标为空或为 0，请直接说明"数据不足"。输出简体中文，简洁专业。',
  en:
    'You are a nail salon business analyst. Interpret ONLY the pre-computed metrics provided. ' +
    'Never invent numbers, style names, or facts. When a metric is empty or zero, say "insufficient data". ' +
    'Respond in English, concise and professional.',
};

/**
 * Narrate the computed insights. Tries the model with a strict grounding prompt; falls back to a
 * deterministic narration of the same numbers on missing key, network error, or invalid output.
 */
export async function summarizeInsights(
  insights: MerchantInsights,
  opts: SummarizeOptions = {},
): Promise<AISummary> {
  const language = opts.language ?? 'zh-CN';
  const env = opts.env ?? process.env;
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) return fallbackSummary(insights, language);

  const postChat = opts.postChat ?? postOpenRouterChat;
  const model = env.INSIGHTS_MODEL_NAME ?? env.GEMINI_IMAGE_MODEL_NAME ?? defaultTryOnModel;
  const brief = buildInsightsBrief(insights, language);
  const userPrompt =
    language === 'en'
      ? `Below are this studio's pre-computed metrics. Generate headline, up to 3 insights, and up to 2 actions:\n\n${brief}`
      : `以下是本店已计算好的经营指标，请据此生成 headline、最多3条 insights、最多2条 actions：\n\n${brief}`;

  const payload: OpenRouterPayload = {
    model,
    response_format: responseFormat,
    provider: { require_parameters: true },
    messages: [
      { role: 'system', content: systemPrompts[language] },
      { role: 'user', content: userPrompt },
    ],
  };

  const timeoutMs = Number(env.INSIGHTS_TIMEOUT_MS ?? 6000);
  try {
    const data = await withTimeout(postChat(payload, apiKey), timeoutMs);
    const parsed = parseAISummary(extractTextContent(data));
    return parsed ? { ...parsed, source: 'ai' } : fallbackSummary(insights, language);
  } catch {
    return fallbackSummary(insights, language);
  }
}
