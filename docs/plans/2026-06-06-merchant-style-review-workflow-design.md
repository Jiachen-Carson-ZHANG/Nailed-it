# Merchant Style Upload And Review Workflow

**Status:** Approved  
**Date:** 2026-06-06

## Problem

The merchant style-library page currently combines four distinct jobs inside a compact card grid:

- uploading a design;
- waiting for AI analysis;
- browsing the collection;
- editing and publishing a detailed catalog configuration.

The upload form asks for a title before the AI has named the design, and the full service editor is
cramped inside each collection card. This makes the primary workflow difficult to scan and use.

## Decision

Split the workflow into a collection surface and a dedicated review workspace.

### Collection Route

`/merchant/styles` is the merchant's collection page.

- Replace the title + file + submit form with one large image-upload tile matching the customer
  image-upload interaction.
- Selecting an image uploads the private original and creates a `processing` merchant-style record
  with a temporary title.
- As soon as upload/create returns the style id, navigate to
  `/merchant/styles/[styleId]/review`. Navigation does not wait for AI analysis.
- Collection cards show only the image, title, status, derived price/duration, and relevant
  commands. Detailed configuration is never embedded inside a collection card.

### Review Route

`/merchant/styles/[styleId]/review` is a dedicated review workspace without bottom navigation.

- Show a large private-image preview.
- Show an explicit **AI breakdown** action for an unconfigured `processing` draft; the merchant
  starts stored-image AI analysis from the review page.
- Show an explicit analysis/loading state while keeping the page usable.
- Present editable AI-suggested title and description.
- Show selected price/time items first and a searchable catalog list for adding services.
- Lock `per_set` quantities to one; preserve quantity controls for quantity-bearing units.
- Show a live server-derived quote preview.
- Provide clear `Save draft` and `Publish` actions.

If AI analysis fails, the record becomes `needs_review` with an editable empty configuration. AI is
suggestion-only; publication always requires explicit merchant approval.

## Backend Workflow

Split the current blocking upload action:

1. **Upload/create:** validate the file, upload the private original, create a `processing` record,
   and return the style id.
2. **Analyze stored image:** download the private original through the Storage seam, run the strict
   catalog recognizer, derive price/duration, persist the suggestion, and transition the record to
   `needs_review`.

The analysis completion write must update configuration and review status atomically. A failed
analysis must transition the record to `needs_review` without pretending a configuration exists.

Add merchant-scoped actions for:

- retrieving one review draft;
- starting stored-image analysis;
- previewing the deterministic quote for edited selections;
- saving the reviewed draft without publishing;
- publishing the approved draft.

## Invariants

- Customer reads remain published-only.
- Private original bytes and paths never reach the customer surface.
- The browser chooses catalog ids and quantities but never supplies price or duration.
- `quoteService` remains the authority for previews and publication snapshots.
- `per_set` quantity remains one at UI, service, and database boundaries.
- AI failure never blocks manual merchant review.
- Reopening a configured `needs_review` style does not rerun AI automatically.
- Opening a new `processing` style does not spend an AI call until the merchant clicks
  **AI breakdown**.

## Verification

- Action/service tests prove upload returns a `processing` draft before analysis.
- Storage tests prove stored private bytes can be downloaded for analysis.
- Repository/migration tests prove analysis completion and failure move drafts to `needs_review`.
- Page tests prove upload selection navigates to the review route and collection cards contain no
  embedded editor.
- Review-page tests prove analysis state, editable configuration, quote preview, save, and publish.
- Full Vitest, TypeScript, production build, and focused browser QA cover the end-to-end flow.
