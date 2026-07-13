const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

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
  response_format?: OpenRouterJsonSchemaResponseFormat;
  provider?: {
    require_parameters?: boolean;
  };
  plugins?: Array<{
    id: string;
  }>;
};

export type OpenRouterJsonSchemaResponseFormat = {
  type: 'json_schema';
  json_schema: {
    name: string;
    strict: true;
    schema: Record<string, unknown>;
  };
};

type FetchLike = (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

type ArkInputPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string };

function toArkInput(messages: OpenRouterMessage[]): Array<{ role: OpenRouterMessage['role']; content: ArkInputPart[] }> {
  return messages.map((message) => ({
    role: message.role,
    content: (
      typeof message.content === 'string'
        ? [{ type: 'input_text', text: message.content }]
        : message.content.map((part) =>
            part.type === 'text'
              ? { type: 'input_text', text: part.text }
              : { type: 'input_image', image_url: part.image_url.url }
          )
    )
  }));
}

const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';

export async function postOpenRouterChat(
  payload: OpenRouterPayload,
  apiKey: string,
  fetchImpl: FetchLike = fetch
): Promise<unknown> {
  // Provider routing (VISION_MODEL_PROVIDER=gemini): Ark (cn-beijing) is unreachable from some dev
  // networks, killing every AI feature at once. Gemini's OpenAI-compatible endpoint accepts the same
  // message shape (text parts + data: image_url) and response_format, so the payload travels as-is;
  // only OpenRouter-specific fields (provider/plugins) are dropped. Default stays Ark for prod.
  if ((process.env.VISION_MODEL_PROVIDER ?? '').toLowerCase() === 'gemini') {
    const geminiKey = process.env.GEMINI_API_KEY ?? apiKey;
    const response = await fetchImpl(`${GEMINI_OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${geminiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.VISION_MODEL_NAME ?? 'gemini-2.5-flash-lite',
        messages: payload.messages,
        ...(payload.response_format ? { response_format: payload.response_format } : {})
      })
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(`Gemini error ${response.status}: ${JSON.stringify(json)}`);
    }
    return json;
  }

  const response = await fetchImpl(`${process.env.ARK_BASE_URL ?? ARK_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: payload.model,
      input: toArkInput(payload.messages)
    })
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(`Ark error ${response.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

export function extractTextContent(data: unknown): string {
  const record = asRecord(data);
  const outputText = typeof record.output_text === 'string' ? record.output_text.trim() : '';
  if (outputText) return outputText;

  // OpenAI-compatible chat shape (Gemini path): choices[0].message.content.
  const choices = Array.isArray(record.choices) ? record.choices : [];
  for (const choice of choices) {
    const message = asRecord(asRecord(choice).message);
    const text = typeof message.content === 'string' ? message.content.trim() : '';
    if (text) return text;
  }

  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    const itemRecord = asRecord(item);
    const content = Array.isArray(itemRecord.content) ? itemRecord.content : [];
    for (const part of content) {
      const partRecord = asRecord(part);
      const text = typeof partRecord.text === 'string' ? partRecord.text.trim() : '';
      if (text) return text;
    }
  }

  throw new Error('Ark response did not include text content.');
}

export function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
