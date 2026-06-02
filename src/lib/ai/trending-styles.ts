import type { AITrendingResponse, AITrendingStyle, TrendingSearchLink } from '@/domain/nail';
import { asRecord, parseGeminiUsageMetadata } from './usage-cost';

export const defaultGeminiImageModel = 'gemini-3.1-flash-image-preview';

const geminiGenerateContentBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

export class TrendingStylesError extends Error {
  constructor(
    public readonly code:
      | 'missing_config'
      | 'provider_error'
      | 'invalid_model_output',
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TrendingStylesError';
  }
}

export async function fetchAITrendingStyles(env = process.env): Promise<AITrendingResponse> {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new TrendingStylesError('missing_config', 'GEMINI_API_KEY is required for trending styles.');
  }

  const model = env.GEMINI_IMAGE_MODEL_NAME ?? defaultGeminiImageModel;
  const now = new Date();
  const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const prompt = [
    `List the top 10 trending nail styles RIGHT NOW in ${monthYear}.`,
    'Consider: seasonal aesthetics, viral looks on social media, dominant colors, popular techniques.',
    'For each style provide: rank (1-10), name in English, name in Chinese (nameCn),',
    'a 1-2 sentence description, and 3-5 short tag strings (e.g. "ombre", "pastel", "gel").',
    'Return a JSON array of objects with keys: rank, name, nameCn, description, tags.'
  ].join(' ');

  const response = await fetch(`${geminiGenerateContentBaseUrl}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: trendingStylesSchema
      }
    })
  });

  const responseJson = await response.json();

  if (!response.ok) {
    throw new TrendingStylesError(
      'provider_error',
      `Gemini trending request failed with status ${response.status}.`,
      { cause: responseJson }
    );
  }

  parseGeminiUsageMetadata(responseJson);

  const rawStyles = parseGeminiTrendingResponse(responseJson);
  const styles = rawStyles.map((raw) => normalizeTrendingStyle(raw));

  return {
    styles,
    generatedAt: now.toISOString()
  };
}

function parseGeminiTrendingResponse(responseJson: unknown): unknown[] {
  const record = asRecord(responseJson);
  const candidates = Array.isArray(record.candidates) ? record.candidates : [];

  for (const candidate of candidates) {
    const content = asRecord(asRecord(candidate).content);
    const parts = Array.isArray(content.parts) ? content.parts : [];

    for (const part of parts) {
      const text = asRecord(part).text;
      if (typeof text === 'string' && text.trim()) {
        try {
          const parsed = JSON.parse(stripJsonFence(text));
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // try next part
        }
      }
    }
  }

  throw new TrendingStylesError('invalid_model_output', 'Gemini response did not include a valid JSON array.');
}

function normalizeTrendingStyle(raw: unknown): AITrendingStyle {
  const record = asRecord(raw);
  const rank = typeof record.rank === 'number' ? Math.floor(record.rank) : 0;
  const name = typeof record.name === 'string' ? record.name.trim() : 'Trending Style';
  const nameCn = typeof record.nameCn === 'string' ? record.nameCn.trim() : name;
  const description = typeof record.description === 'string' ? record.description.trim() : '';
  const tags: string[] = Array.isArray(record.tags)
    ? record.tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim())
    : [];

  return {
    rank,
    name,
    nameCn,
    description,
    tags,
    searchLinks: buildSearchLinks(name)
  };
}

function buildSearchLinks(name: string): TrendingSearchLink[] {
  const encoded = encodeURIComponent(`${name} nail style`);
  const encodedXhs = encodeURIComponent(`${name} 美甲`);

  return [
    {
      platform: 'Pinterest',
      label: 'Pinterest',
      url: `https://www.pinterest.com/search/pins/?q=${encoded}`
    },
    {
      platform: 'Xiaohongshu',
      label: '小红书',
      url: `https://www.xiaohongshu.com/search_result?keyword=${encodedXhs}`
    },
    {
      platform: 'Google Images',
      label: 'Google',
      url: `https://www.google.com/search?tbm=isch&q=${encoded}`
    },
    {
      platform: 'TikTok',
      label: 'TikTok',
      url: `https://www.tiktok.com/search?q=${encoded}`
    }
  ];
}

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
}

const trendingStylesSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      rank: { type: 'number' },
      name: { type: 'string' },
      nameCn: { type: 'string' },
      description: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } }
    },
    required: ['rank', 'name', 'nameCn', 'description', 'tags']
  }
} as const;
