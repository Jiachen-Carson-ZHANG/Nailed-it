const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
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
    content:
      typeof message.content === 'string'
        ? [{ type: 'input_text', text: message.content }]
        : message.content.map((part) =>
            part.type === 'text'
              ? { type: 'input_text', text: part.text }
              : { type: 'input_image', image_url: part.image_url.url }
          ),
  }));
}

// Use OpenRouter + Gemini when both OPENROUTER_API_KEY and GEMINI_IMAGE_MODEL_NAME are set;
// otherwise fall back to Ark.
export async function postOpenRouterChat(
  payload: OpenRouterPayload,
  arkApiKey: string,
  fetchImpl: FetchLike = fetch
): Promise<unknown> {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const geminiModel = process.env.GEMINI_IMAGE_MODEL_NAME;

  if (openrouterKey && geminiModel) {
    const response = await fetchImpl(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: geminiModel,
        messages: payload.messages,
        ...(payload.response_format ? { response_format: payload.response_format } : {}),
      }),
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(`OpenRouter error ${response.status}: ${JSON.stringify(json)}`);
    }
    return json;
  }

  // Ark fallback
  const baseUrl = process.env.ARK_BASE_URL ?? ARK_BASE_URL;
  const response = await fetchImpl(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${arkApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: payload.model,
      input: toArkInput(payload.messages),
    }),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Ark error ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export function extractTextContent(data: unknown): string {
  const record = asRecord(data);

  // OpenAI-compatible shape (OpenRouter/Gemini): choices[0].message.content
  const choices = Array.isArray(record.choices) ? record.choices : [];
  for (const choice of choices) {
    const message = asRecord(asRecord(choice).message);
    const content = message.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      for (const part of content) {
        const text = asRecord(part).text;
        if (typeof text === 'string' && text.trim()) return text.trim();
      }
    }
  }

  // Ark responses shape: output[].content[].text
  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    const content = Array.isArray(asRecord(item).content) ? asRecord(item).content as unknown[] : [];
    for (const part of content) {
      const text = asRecord(part).text;
      if (typeof text === 'string' && text.trim()) return text.trim();
    }
  }

  throw new Error('AI response did not include text content.');
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

// Image generation: OpenRouter + Gemini when both keys are set, otherwise Ark /images/generations.
// Returns base64 image string.
export async function postImageGeneration(opts: {
  arkApiKey: string;
  arkModel: string;
  arkBaseUrl: string;
  prompt: string;
  images: Array<{ base64: string; mimeType: string }>;
}): Promise<string> {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const geminiModel = process.env.GEMINI_IMAGE_MODEL_NAME;

  // Use OpenRouter+Gemini when both keys are set.
  // Must use streaming — non-streaming returns content:null for image generation responses.
  if (openrouterKey && geminiModel) {
    const imageParts = opts.images.map((img) => ({
      type: 'image_url' as const,
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    }));
    const textPart = { type: 'text' as const, text: opts.prompt };
    const body: Record<string, unknown> = {
      model: geminiModel,
      stream: true,
      messages: [
        {
          role: 'user',
          content: opts.images.length > 0 ? [...imageParts, textPart] : [textPart],
        },
      ],
      output_modalities: ['image'],
    };
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter image generation error ${response.status}: ${JSON.stringify(errJson)}`);
    }
    // Collect streaming SSE chunks and extract image_url parts from deltas
    const reader = response.body?.getReader();
    if (!reader) throw new Error('OpenRouter response body is not readable.');
    const decoder = new TextDecoder();
    let buffer = '';
    let imageB64 = '';
    while (!imageB64) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const chunk = JSON.parse(data) as Record<string, unknown>;
          const choice = asRecord(Array.isArray(chunk.choices) ? (chunk.choices as unknown[])[0] : {});
          const delta = asRecord(choice.delta);
          // Image is in delta.images[], not delta.content
          const images = Array.isArray(delta.images) ? delta.images : [];
          for (const img of images) {
            const url = asRecord(asRecord(img).image_url).url;
            if (typeof url === 'string') {
              const b64 = url.replace(/^data:[^;]+;base64,/, '');
              if (b64) { imageB64 = b64; break; }
            }
          }
          // Fallback: also check content parts in case format changes
          const content = delta.content;
          const parts = Array.isArray(content) ? content : [];
          for (const part of parts) {
            const p = asRecord(part);
            if (p.type === 'image_url') {
              const url = asRecord(p.image_url).url;
              if (typeof url === 'string') {
                imageB64 = url.replace(/^data:[^;]+;base64,/, '');
              }
            }
          }
        } catch { /* skip malformed chunks */ }
      }
    }
    reader.cancel().catch(() => {});
    if (!imageB64) throw new Error('OpenRouter image generation response did not include an image.');
    return imageB64;
  }

  // Ark fallback
  const response = await fetch(`${opts.arkBaseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.arkApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.arkModel,
      prompt: opts.prompt,
      image: opts.images.map((img) => `data:${img.mimeType};base64,${img.base64}`),
      response_format: 'b64_json',
      sequential_image_generation: 'disabled',
      watermark: false,
    }),
  });
  const json = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`Ark image generation error ${response.status}: ${JSON.stringify(json)}`);
  }
  const items = Array.isArray(json.data) ? json.data : [];
  const b64 = typeof asRecord(items[0]).b64_json === 'string' ? String(asRecord(items[0]).b64_json) : '';
  if (!b64) throw new Error('Ark image generation response did not include an image.');
  return b64;
}

