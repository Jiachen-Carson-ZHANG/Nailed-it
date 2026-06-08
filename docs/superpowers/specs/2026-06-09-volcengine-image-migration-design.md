# Volcengine Image Migration Design

**Date:** 2026-06-09

## Goal

Migrate the image-related AI paths from OpenRouter to Volcengine Ark with the smallest safe patch, while preserving the existing route contracts, business flow, and UI behavior.

This migration is intentionally limited to image-related capabilities:

- Nail image recognition
- Merchant style breakdown from image
- Merchant style-name recognition from image
- Try-on image validation
- Try-on final image generation

Text-only OpenRouter features remain out of scope for this round:

- `trending-styles`
- `insights-summary`

## Confirmed Scope Decisions

The following decisions were confirmed during brainstorming and are fixed for implementation:

- Only image-related AI paths move off OpenRouter in this round
- `trending-styles` and `insights-summary` stay on OpenRouter for now
- The migration follows the minimal-patch strategy rather than a full provider-layer redesign
- Existing API route paths and frontend request/response contracts should remain unchanged
- `src/nail-ai/openrouter.ts` stays in place for this round to minimize import churn
- Image understanding tasks move to `doubao-seed-2-0-lite-260215`
- Final try-on image generation moves to `doubao-seedream-5.0-litenew`
- Try-on generation should return base64 image data rather than temporary URLs

## Problems To Fix

### 1. Image AI Is Coupled To OpenRouter Chat Semantics

The current image-related paths assume an OpenRouter `chat/completions` contract through `src/nail-ai/openrouter.ts`. This couples image recognition, image validation, and try-on generation to one provider-specific transport and one response shape.

That coupling is now a deployment risk because OpenRouter availability is region-sensitive in the current production environment.

### 2. Visual Understanding And Image Generation Are Mixed Together

The current implementation routes both of these categories through the same OpenRouter-based helper:

- image -> text / JSON understanding
- image + image -> generated image

This is no longer valid after migration because Volcengine Ark exposes these capabilities through different APIs:

- `POST /responses` for multimodal understanding
- `POST /images/generations` for image generation and editing

### 3. The Current Model Configuration Is Too Shared

Several image-related files currently reuse the same environment-driven model selection pattern. This was workable while everything flowed through one provider surface, but it becomes unstable once understanding and generation require different model families.

The migration must separate:

- vision understanding model configuration
- image generation model configuration

without forcing a large redesign of the whole AI layer.

## Recommended Architecture Approach

This migration should preserve the current application shape and patch the provider boundary with the fewest invasive changes.

The design follows four rules:

- Keep upper-layer call sites and file boundaries as stable as possible
- Retain `src/nail-ai/openrouter.ts` for this round, but repurpose its implementation for Ark multimodal understanding where practical
- Allow `try-on.ts` to become the only intentional exception that directly uses Ark image generation
- Do not expand this round into a general provider abstraction or a whole-project OpenRouter removal

This keeps the patch focused on the production issue while reducing migration risk in nearby flows that already work.

## Detailed Design

## 1. Provider Boundary Strategy

The minimal-patch approach keeps `src/nail-ai/openrouter.ts` in place, but changes its role from an OpenRouter-specific helper into a compatibility boundary for image understanding calls.

Expected behavior after migration:

- `postOpenRouterChat()` keeps its current name so existing imports remain stable
- Internally, it sends Volcengine Ark multimodal understanding requests to `POST /responses`
- `extractTextContent()` is updated so it can extract the generated text from Ark response payloads
- Existing helper functions such as `stripJsonFence()` and `asRecord()` remain available because the upper layers still rely on them

This is intentionally not a long-term naming solution. It is a tactical compatibility layer used to minimize file churn in the current round.

## 2. Vision Understanding Paths

The following files continue to behave like "image in -> text or JSON out" flows:

- `src/nail-ai/nail-recognition.ts`
- `src/nail-ai/breakdown.ts`
- `src/nail-ai/style-config-recognition.ts`
- `src/nail-ai/try-on.ts` validation step only

All of these should use:

- Model: `doubao-seed-2-0-lite-260215`
- API family: `POST /responses`
- Image input format: existing base64 data URLs

### 2.1 Nail Recognition

`src/nail-ai/nail-recognition.ts` keeps the same recognition flow:

- send image + prompt
- extract text
- parse JSON
- normalize to the supported internal recognition contract

Required updates:

- Replace `OPENROUTER_API_KEY` reads with `ARK_API_KEY`
- Replace the default image model with `doubao-seed-2-0-lite-260215`
- Update telemetry provider labeling from `openrouter` to `volcengine`
- Preserve the current normalization and error taxonomy as much as possible

### 2.2 Merchant Style Breakdown

`src/nail-ai/breakdown.ts` should continue reusing its existing prompt and runtime validation structure.

The migration goal is not to rewrite the breakdown logic. The goal is to swap the transport and response parsing underneath it.

Important constraint:

- The current OpenRouter path uses schema-oriented response formatting
- Ark support for an identical contract may differ by endpoint and payload shape

Therefore the implementation must be conservative:

- prefer structured output support if it can be expressed safely
- keep the current runtime JSON validation as the authoritative guardrail
- fail closed rather than trust model structure blindly

### 2.3 Merchant Style Name Recognition

`src/nail-ai/style-config-recognition.ts` should follow the same migration pattern as `breakdown.ts`:

- keep prompt and retry behavior
- keep runtime parsing and validation
- swap provider transport to Ark multimodal understanding

This maintains behavior parity while keeping the patch size small.

## 3. Try-On Split

`src/nail-ai/try-on.ts` is the only file that must intentionally split its provider behavior in this migration.

### 3.1 Validation Step

The current `validateImages()` behavior remains conceptually the same:

- two images are checked before the expensive generation step
- the model returns a small JSON result describing whether the inputs are valid

After migration:

- validation uses `doubao-seed-2-0-lite-260215`
- validation is sent through Ark `POST /responses`
- output is still parsed as text JSON through the compatibility helper

### 3.2 Final Generation Step

The final try-on image generation step must stop using the compatibility helper and directly call Ark image generation:

- API: `POST /images/generations`
- Model: `doubao-seedream-5.0-litenew`
- Inputs: hand image + style image + existing try-on prompt

Required request defaults:

- `response_format: "b64_json"`
- `sequential_image_generation: "disabled"`
- `watermark: false`

Required response handling:

- read `data[0].b64_json`
- map the returned base64 to the existing `TryOnResult`
- keep the existing route-level response shape unchanged for the frontend

This keeps try-on compatible with the current UI without adding a download-and-reencode step.

## 4. Environment Model Split

This round introduces a minimal but necessary separation between image understanding and image generation model configuration.

Required environment variables:

```env
ARK_API_KEY=your_key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_VISION_MODEL=doubao-seed-2-0-lite-260215
ARK_IMAGE_MODEL=doubao-seedream-5.0-litenew
```

Behavioral rules:

- image understanding paths should read `ARK_VISION_MODEL`
- try-on generation should read `ARK_IMAGE_MODEL`
- image-related paths should no longer depend on `OPENROUTER_API_KEY`
- text-only paths that are out of scope may continue using OpenRouter configuration temporarily

This is intentionally a partial migration. The project should not claim full OpenRouter removal until the text-only paths are also migrated.

## 5. File-Level Change Plan

### Files To Modify

- `src/nail-ai/openrouter.ts`
- `src/nail-ai/nail-recognition.ts`
- `src/nail-ai/breakdown.ts`
- `src/nail-ai/style-config-recognition.ts`
- `src/nail-ai/try-on.ts`
- `src/nail-ai/nail-recognition.test.ts`
- any directly affected try-on tests added or updated during implementation

### Files Explicitly Out Of Scope

- `src/nail-ai/trending-styles.ts`
- `src/nail-ai/insights-summary.ts`
- API routes and page components that do not need contract changes

### Why `openrouter.ts` Stays For Now

Keeping the filename and export surface avoids a cascade of mostly cosmetic changes across multiple files. The trade-off is that the name becomes temporarily misleading, but the patch remains smaller and safer.

This file should be renamed in a later cleanup round when the remaining OpenRouter paths are migrated.

## 6. Error Handling And Guardrails

The migration should preserve the existing fail-closed behavior:

- provider failures become the existing provider-style errors
- invalid or non-JSON model output still fails validation
- business decisions continue to rely on deterministic app logic, not model trust

Special handling for try-on generation:

- if Ark image generation returns no `b64_json` image payload, treat it as invalid provider output
- do not silently substitute a URL-based flow in this round

## Testing Strategy

## Functional Checks

- Nail recognition still accepts image base64 input and returns normalized recognition output
- Breakdown still returns a validated structured result or fails closed
- Style-name recognition still retries and validates parsed output
- Try-on validation still rejects obviously invalid hand or style inputs
- Try-on final generation returns a base64 image that the current UI can display without contract changes

## Provider Boundary Checks

- Image-related paths no longer require `OPENROUTER_API_KEY`
- Image-related paths use `ARK_API_KEY`
- Vision understanding requests target Ark `responses`
- Try-on image generation targets Ark `images/generations`

## Regression Checks

- Existing API route request and response shapes remain unchanged for the frontend
- Customer booking result flow still works after recognition
- Merchant style review workflow still performs image-based AI steps
- Text-only OpenRouter features continue to work because they are out of scope for this round

## Risks And Guardrails

### Risk: The Compatibility Layer Hides A Provider Mismatch

Reusing `openrouter.ts` can obscure the fact that Ark understanding and OpenRouter chat are different protocols.

Guardrail:

- Keep the compatibility layer limited to this migration scope
- Document that the file name is tactical and temporary
- Avoid extending this pattern to new features

### Risk: Structured Output Is Less Deterministic Than Before

If Ark structured output behavior differs from OpenRouter response formatting, breakdown or style-name parsing may become less stable.

Guardrail:

- Keep strict runtime parsing and validation in place
- Preserve retry logic where it already exists
- Fail closed rather than allowing malformed model output through pricing or publication flows

### Risk: Try-On Generation Response Shape Differs From Current Assumptions

The current try-on path expects image data embedded in the provider response. Ark generation returns a different shape.

Guardrail:

- Standardize on `response_format: "b64_json"`
- Add focused parsing coverage for the Ark generation response
- Keep the final returned application contract unchanged

## Acceptance Criteria

This migration is complete only when all of the following are true:

- `nail-recognition`, `breakdown`, `style-config-recognition`, and try-on validation use Ark multimodal understanding
- Try-on final generation uses Ark image generation with `doubao-seedream-5.0-litenew`
- The image-related paths no longer depend on `OPENROUTER_API_KEY`
- The frontend-facing request and response contracts stay unchanged
- `trending-styles` and `insights-summary` remain untouched in this round
- The project can complete image-related AI flows without relying on OpenRouter regional availability
