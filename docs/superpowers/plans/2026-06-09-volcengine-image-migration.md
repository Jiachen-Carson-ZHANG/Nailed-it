# Volcengine Image Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the image-related AI paths from OpenRouter to Volcengine Ark using the smallest safe patch, while keeping existing API route and frontend contracts unchanged.

**Architecture:** Keep `src/nail-ai/openrouter.ts` as a temporary compatibility boundary for image-understanding calls, but reimplement it against Ark `responses`. Split `src/nail-ai/try-on.ts` so validation still uses the compatibility boundary while final image generation calls Ark `images/generations` directly and returns base64 image data.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, server-side `fetch`, Volcengine Ark `responses` and `images/generations` APIs

---

### Task 1: Repoint The Shared Image-Understanding Adapter

**Files:**
- Modify: `src/nail-ai/openrouter.ts`
- Test: `src/nail-ai/nail-recognition.test.ts`

- [ ] **Step 1: Write the failing test for Ark request routing**

Update `src/nail-ai/nail-recognition.test.ts` so the provider test asserts Ark configuration instead of OpenRouter:

```ts
expect(result.telemetry).toMatchObject({
  provider: 'volcengine',
  model: defaultVisionModel
});

const [url, request] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
expect(url).toBe('https://ark.cn-beijing.volces.com/api/v3/responses');
expect((request?.headers as Record<string, string>)?.Authorization).toBe('Bearer test-ark-key');

const body = JSON.parse(String(request?.body));
expect(body.model).toBe(defaultVisionModel);
expect(body.input[0].content[0]).toEqual({
  type: 'input_image',
  image_url: 'data:image/jpeg;base64,abc123'
});
expect(body.input[0].content[1]).toEqual({
  type: 'input_text',
  text: expect.stringContaining('Return ONLY valid JSON')
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/nail-ai/nail-recognition.test.ts`

Expected: FAIL because the test still sees `https://openrouter.ai/api/v1/chat/completions`, `OPENROUTER_API_KEY`, and `provider: 'openrouter'`.

- [ ] **Step 3: Reimplement `openrouter.ts` as an Ark compatibility boundary**

Replace the OpenRouter transport in `src/nail-ai/openrouter.ts` with an Ark `responses` transport while keeping the exported function names stable.

Use this structure:

```ts
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

export type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type OpenRouterPayload = {
  model: string;
  messages: OpenRouterMessage[];
  response_format?: OpenRouterJsonSchemaResponseFormat;
};

function toArkInput(messages: OpenRouterMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: (typeof message.content === 'string'
      ? [{ type: 'input_text', text: message.content }]
      : message.content.map((part) =>
          part.type === 'text'
            ? { type: 'input_text', text: part.text }
            : { type: 'input_image', image_url: part.image_url.url }
        ))
  }));
}

export async function postOpenRouterChat(
  payload: OpenRouterPayload,
  apiKey: string,
  fetchImpl: FetchLike = fetch
): Promise<unknown> {
  const response = await fetchImpl(`${ARK_BASE_URL}/responses`, {
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
  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    const content = Array.isArray(asRecord(item).content) ? (asRecord(item).content as unknown[]) : [];
    for (const part of content) {
      const text = asRecord(part).text;
      if (typeof text === 'string' && text.trim()) return text;
    }
  }
  throw new Error('Ark response did not include text content.');
}
```

- [ ] **Step 4: Update recognition env usage and provider telemetry**

Modify `src/nail-ai/nail-recognition.ts` so it reads `ARK_API_KEY` and reports the new provider name:

```ts
export const defaultVisionModel = 'doubao-seed-2-0-lite-260215';

export type NailRecognitionProviderResult = {
  recognition: AIRecognitionResult;
  telemetry: { provider: 'volcengine'; model: string };
};

const apiKey = env.ARK_API_KEY;
if (!apiKey) {
  throw new NailRecognitionError('missing_vision_config', 'ARK_API_KEY is required for nail recognition.');
}

return {
  recognition: normalizeNailRecognition(parsed),
  telemetry: { provider: 'volcengine', model }
};
```

- [ ] **Step 5: Run the focused tests**

Run: `npm test -- src/nail-ai/nail-recognition.test.ts`

Expected: PASS. The test should now assert Ark URL, Ark key, Ark-shaped request body, and `provider: 'volcengine'`.

- [ ] **Step 6: Commit**

```bash
git add src/nail-ai/openrouter.ts src/nail-ai/nail-recognition.ts src/nail-ai/nail-recognition.test.ts
git commit -m "feat: route image understanding through ark responses"
```

### Task 2: Migrate Breakdown And Style Name Recognition With Runtime Validation Intact

**Files:**
- Modify: `src/nail-ai/breakdown.ts`
- Modify: `src/nail-ai/style-config-recognition.ts`
- Test: `src/nail-ai/breakdown.test.ts`
- Test: `src/nail-ai/style-config-recognition.test.ts`

- [ ] **Step 1: Write the failing tests for Ark env selection**

Add focused assertions to the existing tests that the default image-understanding model and env naming no longer point at Gemini or OpenRouter-specific config.

For `src/nail-ai/breakdown.test.ts`, add:

```ts
import { runBreakdown } from './breakdown';

it('requires ARK_API_KEY for image breakdown', async () => {
  await expect(
    runBreakdown('abc123', 'image/jpeg', settings, 'zh-CN', {})
  ).rejects.toThrow('ARK_API_KEY is required for breakdown.');
});
```

For `src/nail-ai/style-config-recognition.test.ts`, add:

```ts
import { recognizeStyleName } from './style-config-recognition';

it('requires ARK_API_KEY for style naming', async () => {
  await expect(
    recognizeStyleName('abc123', 'image/jpeg', 'zh-CN', {})
  ).rejects.toThrow('ARK_API_KEY is required for style naming.');
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npm test -- src/nail-ai/breakdown.test.ts src/nail-ai/style-config-recognition.test.ts`

Expected: FAIL because both files still read `OPENROUTER_API_KEY`.

- [ ] **Step 3: Update breakdown configuration reads**

Modify `src/nail-ai/breakdown.ts` to switch from OpenRouter env naming to Ark env naming and from shared Gemini naming to a dedicated Ark vision model variable.

Use this patch shape:

```ts
const apiKey = env.ARK_API_KEY;
if (!apiKey) throw new BreakdownError('missing_config', 'ARK_API_KEY is required for breakdown.');

const model = env.ARK_VISION_MODEL ?? 'doubao-seed-2-0-lite-260215';
```

Also make the provider-facing messages provider-neutral:

```ts
throw new BreakdownError('provider_error', 'Ark breakdown request failed.', { cause: error });
throw new BreakdownError('invalid_model_output', 'Ark breakdown response did not include valid JSON.', {
  cause: error
});
```

- [ ] **Step 4: Keep runtime validation authoritative in breakdown**

Do not remove `parseBreakdownModelOutput()` or schema assertions. If `response_format` is left attached in the payload for compatibility, keep the downstream JSON parse and runtime contract checks exactly as the authoritative boundary:

```ts
const text = extractTextContent(data);
return JSON.parse(stripJsonFence(text));
```

This step is complete only if no pricing or catalog decision starts trusting provider structure without local validation.

- [ ] **Step 5: Update style-name configuration reads**

Modify `src/nail-ai/style-config-recognition.ts`:

```ts
const apiKey = env.ARK_API_KEY;
if (!apiKey) throw new Error('ARK_API_KEY is required for style naming.');
const model = env.ARK_VISION_MODEL ?? 'doubao-seed-2-0-lite-260215';
```

Keep:

```ts
return parseStyleNameOutput(JSON.parse(stripJsonFence(extractTextContent(data))));
```

Do not remove retry behavior or runtime parsing.

- [ ] **Step 6: Run the targeted tests**

Run: `npm test -- src/nail-ai/breakdown.test.ts src/nail-ai/style-config-recognition.test.ts`

Expected: PASS. Existing parsing contract tests should still pass, and the new env-name tests should now pass as well.

- [ ] **Step 7: Commit**

```bash
git add src/nail-ai/breakdown.ts src/nail-ai/style-config-recognition.ts src/nail-ai/breakdown.test.ts src/nail-ai/style-config-recognition.test.ts
git commit -m "feat: move image breakdown and naming to ark config"
```

### Task 3: Split Try-On Validation From Final Image Generation

**Files:**
- Modify: `src/nail-ai/try-on.ts`
- Test: `src/nail-ai/try-on.test.ts`

- [ ] **Step 1: Create the failing try-on parsing test**

Create `src/nail-ai/try-on.test.ts` with focused coverage for Ark image generation response parsing and Ark env reads:

```ts
import { describe, expect, it } from 'vitest';
import { runTryOn, TryOnError } from './try-on';

describe('runTryOn', () => {
  it('requires ARK_API_KEY when try-on runs', async () => {
    await expect(
      runTryOn('hand', 'image/jpeg', 'style', 'image/jpeg', {})
    ).rejects.toMatchObject({ code: 'missing_config' } satisfies Partial<TryOnError>);
  });
});

describe('extractImageFromArkGeneration', () => {
  it('reads b64_json output into the existing TryOnResult contract', () => {
    expect(
      extractImageFromArkGeneration({
        data: [{ b64_json: 'base64-image-data' }]
      })
    ).toEqual({
      imageBase64: 'base64-image-data',
      mimeType: 'image/png'
    });
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npm test -- src/nail-ai/try-on.test.ts`

Expected: FAIL because the file does not exist yet and `extractImageFromArkGeneration` is not implemented.

- [ ] **Step 3: Update try-on env usage and model split**

Modify the top of `src/nail-ai/try-on.ts`:

```ts
export const defaultTryOnModel = 'doubao-seedream-5.0-litenew';
export const defaultTryOnValidationModel = 'doubao-seed-2-0-lite-260215';

const apiKey = env.ARK_API_KEY;
if (!apiKey) throw new TryOnError('missing_config', 'ARK_API_KEY is required for try-on.');

const validationModel = env.ARK_VISION_MODEL ?? defaultTryOnValidationModel;
const generationModel = env.ARK_IMAGE_MODEL ?? defaultTryOnModel;
```

Pass `validationModel` into `validateImages()` and `generationModel` into the final generation call.

- [ ] **Step 4: Keep validation on the shared compatibility helper**

Update `validateImages()` so it continues to call `postOpenRouterChat()`, but now with Ark env values:

```ts
raw = await postOpenRouterChat(
  {
    model: opts.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${opts.handMimeType};base64,${opts.handImageBase64}` } },
          { type: 'image_url', image_url: { url: `data:${opts.styleMimeType};base64,${opts.styleImageBase64}` } },
          { type: 'text', text: validationPrompt }
        ]
      }
    ]
  },
  opts.apiKey
);
```

Do not change the downstream JSON validation or user-facing invalid-input messages.

- [ ] **Step 5: Add the direct Ark image generation helper**

Inside `src/nail-ai/try-on.ts`, add a private helper for the final generation step:

```ts
async function postArkTryOnGeneration(opts: {
  apiKey: string;
  model: string;
  handImageBase64: string;
  handMimeType: string;
  styleImageBase64: string;
  styleMimeType: string;
}): Promise<unknown> {
  const response = await fetch(`${process.env.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3'}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: opts.model,
      prompt: tryOnPrompt,
      image: [
        `data:${opts.handMimeType};base64,${opts.handImageBase64}`,
        `data:${opts.styleMimeType};base64,${opts.styleImageBase64}`
      ],
      response_format: 'b64_json',
      sequential_image_generation: 'disabled',
      watermark: false
    })
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Ark image generation error ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}
```

- [ ] **Step 6: Replace the final generation step and parse Ark output**

Replace the old `postOpenRouterChat()` final generation call with the new helper and add an Ark-specific image parser:

```ts
data = await postArkTryOnGeneration({
  apiKey,
  model: generationModel,
  handImageBase64,
  handMimeType,
  styleImageBase64,
  styleMimeType
});

function extractImageFromArkGeneration(data: unknown): TryOnResult {
  const record = asRecord(data);
  const items = Array.isArray(record.data) ? record.data : [];
  const first = asRecord(items[0]);
  const base64 = typeof first.b64_json === 'string' ? first.b64_json : '';
  if (!base64) {
    throw new TryOnError('invalid_model_output', 'Ark try-on response did not include an image.');
  }
  return { imageBase64: base64, mimeType: 'image/png' };
}
```

Export `extractImageFromArkGeneration` for the test file:

```ts
export { extractImageFromArkGeneration };
```

- [ ] **Step 7: Run the focused try-on tests**

Run: `npm test -- src/nail-ai/try-on.test.ts`

Expected: PASS. The new test should verify both missing Ark config and `b64_json` parsing.

- [ ] **Step 8: Commit**

```bash
git add src/nail-ai/try-on.ts src/nail-ai/try-on.test.ts
git commit -m "feat: split try-on validation and ark image generation"
```

### Task 4: Verify Route-Level Compatibility And Full Image-AI Regression Safety

**Files:**
- Modify: `src/app/api/ai/try-on/route.ts` (only if error handling text or types require adjustment)
- Test: `src/nail-ai/nail-recognition.test.ts`
- Test: `src/nail-ai/breakdown.test.ts`
- Test: `src/nail-ai/style-config-recognition.test.ts`
- Test: `src/nail-ai/try-on.test.ts`

- [ ] **Step 1: Inspect the try-on API route and keep the contract unchanged**

Confirm `src/app/api/ai/try-on/route.ts` still returns:

```ts
return NextResponse.json(result);
```

and still maps provider-side failures to:

```ts
{ error: error.message, code: error.code }
```

Only modify the file if the new Ark-specific error wording requires a test-safe message update. Do not change request body parsing or response shape.

- [ ] **Step 2: Run the entire image-related test set**

Run: `npm test -- src/nail-ai/nail-recognition.test.ts src/nail-ai/breakdown.test.ts src/nail-ai/style-config-recognition.test.ts src/nail-ai/try-on.test.ts`

Expected: PASS. All image-related recognition, parsing, and try-on tests should now pass under Ark-backed config.

- [ ] **Step 3: Run diagnostics on edited files**

Run diagnostics for:

- `src/nail-ai/openrouter.ts`
- `src/nail-ai/nail-recognition.ts`
- `src/nail-ai/breakdown.ts`
- `src/nail-ai/style-config-recognition.ts`
- `src/nail-ai/try-on.ts`
- `src/nail-ai/nail-recognition.test.ts`
- `src/nail-ai/breakdown.test.ts`
- `src/nail-ai/style-config-recognition.test.ts`
- `src/nail-ai/try-on.test.ts`

Expected: no new TypeScript errors.

- [ ] **Step 4: Perform a final diff sanity review**

Run: `git diff -- src/nail-ai/openrouter.ts src/nail-ai/nail-recognition.ts src/nail-ai/breakdown.ts src/nail-ai/style-config-recognition.ts src/nail-ai/try-on.ts src/nail-ai/nail-recognition.test.ts src/nail-ai/breakdown.test.ts src/nail-ai/style-config-recognition.test.ts src/nail-ai/try-on.test.ts`

Review for these invariants:

- no changes to `trending-styles.ts`
- no changes to `insights-summary.ts`
- no frontend contract drift in the try-on route
- no removal of runtime JSON validation in breakdown or style-name recognition

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ai/try-on/route.ts src/nail-ai/openrouter.ts src/nail-ai/nail-recognition.ts src/nail-ai/breakdown.ts src/nail-ai/style-config-recognition.ts src/nail-ai/try-on.ts src/nail-ai/nail-recognition.test.ts src/nail-ai/breakdown.test.ts src/nail-ai/style-config-recognition.test.ts src/nail-ai/try-on.test.ts
git commit -m "test: verify ark image migration compatibility"
```

## Plan Self-Review

### Spec Coverage

- Image-only migration scope is covered by Tasks 1-4
- Minimal-patch strategy and `openrouter.ts` reuse are covered by Task 1
- Vision understanding migration for recognition, breakdown, style naming, and try-on validation is covered by Tasks 1-3
- Try-on final generation migration to Ark image generation is covered by Task 3
- Base64 output contract preservation is covered by Task 3
- Out-of-scope text-only OpenRouter features are protected by Task 4 sanity review

### Placeholder Scan

- No `TODO`, `TBD`, or "implement later" placeholders remain
- Every code-touching task contains concrete code snippets
- Every test task includes exact commands and expected outcomes

### Type Consistency

- `ARK_API_KEY`, `ARK_VISION_MODEL`, and `ARK_IMAGE_MODEL` naming is used consistently across all tasks
- `postOpenRouterChat()` remains the compatibility entry point for understanding paths
- `extractImageFromArkGeneration()` is the only new try-on-specific parser introduced in the plan
