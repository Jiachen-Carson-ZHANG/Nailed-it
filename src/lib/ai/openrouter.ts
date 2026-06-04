const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type OpenRouterMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenRouterContentPart[];
};

export type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type OpenRouterPayload = {
  model: string;
  messages: OpenRouterMessage[];
  modalities?: string[];
};

type FetchLike = (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export async function postOpenRouterChat(
  payload: OpenRouterPayload,
  apiKey: string,
  fetchImpl: FetchLike = fetch
): Promise<unknown> {
  const response = await fetchImpl(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(`OpenRouter error ${response.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

export function extractTextContent(data: unknown): string {
  const record = asRecord(data);
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const message = asRecord(asRecord(choices[0]).message);
  if (typeof message.content === 'string') return message.content;
  throw new Error('OpenRouter response did not include text content.');
}

export function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
