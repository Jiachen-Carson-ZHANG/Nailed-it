import type { AITrendingResponse, AITrendingStyle, TrendingSearchLink } from '@/domain/nail';
import { postOpenRouterChat, extractTextContent, stripJsonFence, asRecord } from './openrouter';

export const defaultTrendingModel = 'doubao-seed-2-0-lite-260428';

export class TrendingStylesError extends Error {
  constructor(
    public readonly code: 'missing_config' | 'provider_error' | 'invalid_model_output',
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TrendingStylesError';
  }
}

export async function fetchAITrendingStyles(env = process.env): Promise<AITrendingResponse> {
  const apiKey = env.ARK_API_KEY;
  if (!apiKey) {
    throw new TrendingStylesError('missing_config', 'ARK_API_KEY is required for trending styles.');
  }

  const model = env.ARK_TRENDING_MODEL ?? env.ARK_VISION_MODEL ?? defaultTrendingModel;
  const now = new Date();
  const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const prompt = [
    `List the top 3 trending nail styles RIGHT NOW in ${monthYear}.`,
    'Consider: seasonal aesthetics, viral looks on social media, dominant colors, popular techniques.',
    'For each style provide: rank (1-10), name in English, name in Chinese (nameCn),',
    'a 1-2 sentence description, and 3-5 short tag strings (e.g. "ombre", "pastel", "gel").',
    'Return ONLY a valid JSON array (no markdown, no explanation) with objects having keys: rank, name, nameCn, description, tags.'
  ].join(' ');

  let data: unknown;
  try {
    data = await postOpenRouterChat(
      { model, messages: [{ role: 'user', content: prompt }] },
      apiKey
    );
  } catch (error) {
    throw new TrendingStylesError('provider_error', 'Ark trending request failed.', { cause: error });
  }

  let rawStyles: unknown[];
  try {
    const text = extractTextContent(data);
    const parsed = JSON.parse(stripJsonFence(text));
    if (!Array.isArray(parsed)) throw new Error('Expected array');
    rawStyles = parsed;
  } catch (error) {
    throw new TrendingStylesError('invalid_model_output', 'Ark response did not include a valid JSON array.', {
      cause: error
    });
  }

  return {
    styles: rawStyles.map(normalizeTrendingStyle),
    generatedAt: now.toISOString()
  };
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

  return { rank, name, nameCn, description, tags, searchLinks: buildSearchLinks(name, nameCn) };
}

function buildSearchLinks(name: string, nameCn: string): TrendingSearchLink[] {
  const encoded = encodeURIComponent(`${name} nail style`);
  const encodedCn = encodeURIComponent(`${nameCn} 美甲`);

  return [
    {
      platform: 'Pinterest',
      label: 'Pinterest',
      url: `https://www.pinterest.com/search/pins/?q=${encoded}`,
      appUrl: `pinterest://search/pins/?q=${encoded}`,
    },
    {
      platform: 'Xiaohongshu',
      label: '小红书',
      url: `https://www.xiaohongshu.com/search_result?keyword=${encodedCn}`,
      appUrl: `xhsdiscover://search/result?keyword=${encodedCn}`,
    },
    {
      platform: 'Google Images',
      label: 'Google',
      url: `https://www.google.com/search?tbm=isch&q=${encoded}`,
    },
    {
      platform: 'TikTok',
      label: 'TikTok',
      url: `https://www.tiktok.com/search/video?q=${encoded}`,
      appUrl: `tiktok://search?q=${encoded}`,
    },
    {
      platform: 'Douyin',
      label: '抖音',
      url: `https://www.douyin.com/search/${encodedCn}`,
      appUrl: `snssdk1128://search?keyword=${encodedCn}`,
    },
  ];
}
