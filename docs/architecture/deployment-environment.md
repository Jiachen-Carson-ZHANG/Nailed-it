# Deployment Environment Variables

## Purpose

This document lists the environment variables required to run the current production shape of `nailed-it`.

It reflects the current AI split:

- Image-related AI flows and trending styles run on Volcengine Ark
- Some text-only AI flows still run on OpenRouter

Use the root `.env.example` file as the copy-ready template. This document explains which variables are required, which ones are optional, and which runtime paths depend on them.

## Current Provider Split

### Volcengine Ark

These image-related flows now use Volcengine Ark:

- nail recognition
- merchant style breakdown from image
- merchant style-name recognition from image
- try-on image validation
- try-on final image generation
- trending styles

### OpenRouter

These text-only flows still use OpenRouter in the current system shape:

- insights summary

This means production still needs both provider groups unless those text-only paths are migrated in a later round.

## Required Variables

### Core Storage

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes for persistent environments | Supabase repositories and media storage | Omit only if you intentionally want in-memory fallback in local-only work |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for persistent environments | Server-side Supabase client | Keep server-only |

### Image AI On Volcengine Ark

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `ARK_API_KEY` | Yes for Ark-backed AI | all migrated image flows and trending styles | Required after the Ark migration |
| `ARK_BASE_URL` | Recommended | Ark `responses` and `images/generations` | Default is `https://ark.cn-beijing.volces.com/api/v3` |
| `ARK_VISION_MODEL` | Recommended | recognition, breakdown, style naming, try-on validation | Recommended value: `doubao-seed-2-0-lite-260428` |
| `ARK_IMAGE_MODEL` | Recommended | try-on final generation | Recommended value: `doubao-seedream-5-0-260128` |
| `ARK_TRENDING_MODEL` | Recommended | trending styles | Recommended value: `doubao-seed-2-0-lite-260428` |

### Text AI Still On OpenRouter

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | Yes if you use the text-only AI routes | `insights-summary` | Not used by the migrated image paths or trending styles |
| `GEMINI_IMAGE_MODEL_NAME` | Optional fallback | `insights-summary` fallback path | Use a text-capable model name here |
| `INSIGHTS_MODEL_NAME` | Recommended | `insights-summary` | Preferred override for insights summary |
| `INSIGHTS_TIMEOUT_MS` | Optional | `insights-summary` | Defaults to `6000` |

### Optional Cost Logging

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `VISION_INPUT_PRICE_PER_1M_TOKENS` | Optional | AI usage-cost logging | Only needed if you override pricing assumptions |
| `VISION_OUTPUT_PRICE_PER_1M_TOKENS` | Optional | AI usage-cost logging | Only needed if you override pricing assumptions |
| `VISION_COST_LOGGING_ENABLED` | Optional | AI usage-cost logging | Defaults to enabled unless explicitly set to `false` |

### Merchant Agent Service

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `MODEL_PROVIDER` | Recommended | `agent-service` | Default is `openrouter`; use `anthropic` only when running the direct Anthropic SDK path |
| `AGENT_MODEL` | Recommended | `agent-service` | Default for OpenRouter is `google/gemini-2.5-flash`; override for the selected provider |
| `OPENROUTER_BASE_URL` | Optional | `agent-service` OpenRouter path | Defaults to `https://openrouter.ai/api/v1` |
| `ANTHROPIC_API_KEY` | Only if `MODEL_PROVIDER=anthropic` | `agent-service` Anthropic path | OpenRouter runs do not use this |
| `NAILED_APP_URL` | Optional | `agent-service` briefing/customer reads | Defaults to `http://localhost:3000`; set to the deployed app URL outside local dev |
| `NAILED_MERCHANT_ID` | Optional | `agent-service` Supabase writes | Defaults to `merchant-nailed-it` |

## Recommended Production Values

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

ARK_API_KEY=your-ark-api-key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_VISION_MODEL=doubao-seed-2-0-lite-260428
ARK_IMAGE_MODEL=doubao-seedream-5-0-260128
ARK_TRENDING_MODEL=doubao-seed-2-0-lite-260428

OPENROUTER_API_KEY=your-openrouter-api-key
GEMINI_IMAGE_MODEL_NAME=your-openrouter-text-model
INSIGHTS_MODEL_NAME=your-openrouter-text-model
INSIGHTS_TIMEOUT_MS=6000

MODEL_PROVIDER=openrouter
AGENT_MODEL=google/gemini-2.5-flash
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
ANTHROPIC_API_KEY=
NAILED_APP_URL=https://your-app.example.com
NAILED_MERCHANT_ID=merchant-nailed-it
```

## Deployment Notes

### 1. Keep Trending Styles On Ark

`trending-styles` now uses Ark as well.

Use:

- `ARK_API_KEY`
- `ARK_TRENDING_MODEL`

Do not expect `OPENROUTER_API_KEY` to power that route anymore.

### 2. Do Not Reuse The Image Model For Text-Only OpenRouter Routes

`ARK_IMAGE_MODEL` is only for the Ark image-generation path in try-on.

Do not copy `doubao-seedream-5.0-litenew` into:

- `GEMINI_IMAGE_MODEL_NAME`
- `INSIGHTS_MODEL_NAME`

Those remaining OpenRouter routes still expect text output.

### 3. Image AI No Longer Depends On `OPENROUTER_API_KEY`

After the image migration:

- recognition
- breakdown
- style-name recognition
- try-on
- trending styles

should all work with Ark env only. If one of those routes fails with an OpenRouter config error, the deployment is not running the updated code.

### 4. `ARK_BASE_URL` Should Usually Stay At The Default

Use:

`https://ark.cn-beijing.volces.com/api/v3`

Only override it if you intentionally deploy against a different Volcengine Ark region or gateway.

### 5. Supabase Is Still The Persistent Backend

If `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing in a non-test environment, repository and media-storage behavior will fall back or fail in ways that are not suitable for production.

For production deployments, treat both variables as required.

## Validation Checklist

Before promoting a deployment, verify:

- `ARK_API_KEY` is present
- `ARK_VISION_MODEL` is set to `doubao-seed-2-0-lite-260428`
- `ARK_IMAGE_MODEL` is set to `doubao-seedream-5-0-260128`
- `ARK_TRENDING_MODEL` is set to `doubao-seed-2-0-lite-260428`
- `OPENROUTER_API_KEY` is present if `insights-summary` is enabled
- `MODEL_PROVIDER=openrouter` is set for the demo agent service unless intentionally testing the Anthropic path
- `GEMINI_IMAGE_MODEL_NAME` and `INSIGHTS_MODEL_NAME` point to text-capable OpenRouter models when the fallback path is used
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present for persistent environments

## Related Files

- [.env.example](file:///Users/bytedance/Documents/nailed-it/.env.example)
- [current-state.md](file:///Users/bytedance/Documents/nailed-it/docs/architecture/current-state.md)
- [2026-06-09-volcengine-image-migration-design.md](file:///Users/bytedance/Documents/nailed-it/docs/superpowers/specs/2026-06-09-volcengine-image-migration-design.md)
