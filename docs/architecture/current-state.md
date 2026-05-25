# Architecture: Current State

Last updated: 2026-05-25

## Overview

FastAPI application serving two AI-powered features via a shared OpenRouter backend. Static single-page frontend served at `/`.

## Module structure

```
src/
  shared/
    openrouter.py   — shared httpx.AsyncClient, post_chat(), MODEL constant
    upload.py       — read_validated(), MAX_BYTES, ALLOWED_CONTENT_TYPES
  tryon/
    router.py       — POST /api/v1/try-on
    pipeline.py     — builds multimodal payload, returns base64 image
    schemas.py      — TryOnResponse
  breakdown/
    router.py       — POST /api/v1/breakdown?free_mode=bool
    pipeline.py     — builds multimodal payload, parses JSON response
    schemas.py      — NailComponent, BreakdownResponse
static/
  index.html        — single-page UI for both features
main.py             — FastAPI app, mounts both routers and static files
```

## Request flow

```
Browser → POST /api/v1/try-on or /breakdown
  → router: validates files (type + size) via shared upload.read_validated()
  → pipeline: base64-encodes images, builds OpenRouter payload
  → shared/openrouter.post_chat(): single AsyncClient, bearer auth
  → OpenRouter (google/gemini-3.1-flash-image-preview)
  → pipeline: extracts result, returns to router
  → router: wraps in Pydantic response model → JSON to browser
```

## Features

### Virtual Try-On (`/api/v1/try-on`)
- Accepts two images: hand photo + nail style reference
- Returns a generated image (base64) with the style applied to the hand
- Uses `modalities: ["image", "text"]` for image output from OpenRouter

### Component Breakdown (`/api/v1/breakdown?free_mode=false`)
- Accepts 1–10 nail style images
- `free_mode=false` (default): LLM identifies components against a known taxonomy (length, shape, color, style) sourced from `docs/manicure_example_components.pdf`
- `free_mode=true`: LLM freely identifies any components it observes
- Returns structured JSON: components with qty, unit, unit price, total price, time; editable in the frontend

## LLM integration

- Provider: OpenRouter (`https://openrouter.ai/api/v1/chat/completions`)
- Model: `google/gemini-3.1-flash-image-preview` (both features)
- Auth: `OPENROUTER_API_KEY` env var, loaded via `.env` / `python-dotenv`
- Single shared `httpx.AsyncClient` (module-level, 120 s timeout)

## Key constraints

- File uploads: jpeg/png only, 10 MB max per file
- Breakdown: max 10 files per request
- JSON fence-stripping applied to breakdown responses (model sometimes wraps output in markdown)
