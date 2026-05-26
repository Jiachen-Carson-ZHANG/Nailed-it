# Gemini Cost Monitor And Hardening Design

## Goal

Track estimated cost for each live Gemini nail-recognition request and patch the agreed reliability gaps around confidence review, model-output errors, and edge-case domain behavior.

## Architecture

- Keep token/cost monitoring server-side. The customer API continues returning only recognition data, while the server logs a compact cost event.
- Use Gemini `usageMetadata` as the primary source for prompt/output/total token counts. Local tokenizers such as `tiktoken` are not authoritative for Gemini image+text requests.
- Put deterministic quote/review behavior in domain modules, not mock persistence. The operations store should create bookings from a domain decision.

## Cost Formula

For `gemini-2.5-flash-lite` standard paid tier, current official pricing is $0.10 per 1M input tokens and $0.40 per 1M output tokens for text/image/video input. Per call:

```txt
estimatedUsd =
  promptTokenCount * 0.10 / 1_000_000 +
  (candidatesTokenCount + thoughtsTokenCount) * 0.40 / 1_000_000
```

The app will support env overrides for model pricing so docs drift does not require a code deploy:

- `VISION_INPUT_PRICE_PER_1M_TOKENS`
- `VISION_OUTPUT_PRICE_PER_1M_TOKENS`
- `VISION_COST_LOGGING_ENABLED`

## Tradeoffs

This gives accurate per-call estimates when Gemini returns usage metadata and no user-visible cost UI. It does not persist monthly totals yet because the app still has no backend database. If the product later needs budgets or merchant-visible spend, add persistent aggregation rather than expanding console logs.
