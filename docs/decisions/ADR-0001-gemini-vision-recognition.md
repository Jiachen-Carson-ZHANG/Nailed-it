# ADR 0001: Gemini Vision Recognition Boundary

**Status:** Accepted
**Date:** 2026-05-25

## Context

Nailed-it needs real image-model output in the customer booking flow, but the frontend design has already been merged into `main` and `src/app/globals.css` should not be rewritten. The recognition path also must not let a generative model decide commercial values such as price, duration, technician assignment, or availability.

## Decision

Use Gemini as the first live image-recognition provider for customer nail photos. The default model is `gemini-2.5-flash-lite` because it is the cheapest stable multimodal Gemini model suitable for high-volume lightweight extraction. The browser sends inline image data to `/api/ai/recognize-nail-style`; the server reads `GEMINI_API_KEY`, calls Gemini, and normalizes output into the app's `AIRecognitionResult`.

The model may return only:

- base service attributes
- nail shape
- style attributes
- add-ons
- notes
- confidence

Pricing, duration, availability, and booking creation remain deterministic app logic.

## Design Principles

- Keep provider secrets server-side.
- Route low-risk extraction to the cheapest viable model before considering higher-cost fallbacks.
- Preserve the current frontend design surface and avoid global CSS rewrites.
- Keep AI output editable and subordinate to explicit pricing rules.

## Alternatives Considered

- Merge the old Sprint 1 backend branch directly: rejected because it would replace frontend-owned files and `globals.css`.
- Use Gemini Pro by default: rejected because the first task is structured visual extraction, not complex reasoning.
- Keep the flow mock-only: rejected because Sprint 1 requires testing real image-model output.

## Consequences

**Positive**

- Users can test a live photo-to-quote path by adding a Gemini API key.
- Local sample-image testing still works without a provider key.
- Future model routing can add a higher-quality fallback without changing the UI contract.

**Negative**

- Accuracy is not yet proven by a labeled nail-image eval set.
- Booking persistence and merchant-side live data are still mock/in-memory in the current `main` branch.

## References

- `docs/architecture/current-state.md`
- `docs/changes/implementation-log.md`
- Google Gemini image understanding docs: https://ai.google.dev/gemini-api/docs/image-understanding
- Google Gemini structured outputs docs: https://ai.google.dev/gemini-api/docs/structured-output
- Google Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
