# Plan: Merchant upload → instant draft + cloned style-result editor

Date: 2026-06-07
Status: Done (Slices 0–3). 281/281 tests pass. Slice 4 docs = this update.

## Context

Two problems + a redesign, from live merchant testing:

1. **Upload was broken** — `uploadMerchantStyleAction` did `image instanceof File`, but this runtime is
   **Node 18** where `File` is not a global (landed in Node 20). Every jpg/png/webp upload threw
   "File is not defined". **Fixed** (`merchant-style-actions.ts`): guard by excluding the string case
   instead of referencing the `File` global. (Only one site used it; customer recognition uses base64
   API routes.)

2. **Workflow (商家做完直接拍照上传 接AI breakdown 直接入库，不需要 processing，入库直接修改).**
   Today: upload → `processing` status → separate `/merchant/styles/[id]/review` page → server analyze
   workflow → `needs_review` → publish. Desired: upload → the design lands in the library immediately
   as an editable **Draft**, AI breakdown fills it in, edit **in place**, then Save / Publish. No
   processing detour.

3. **Editor UI** should be a clone of the customer book-flow style-result editor
   (`ComponentBreakdownPanel`), with the **卸甲 section removed**, same UI/UX + selection rules, ending
   in two buttons: **Save** + **Publish**. (卸甲 stays in the customer booking flow — removal is a
   customer-booking concern, not a property of a published design.)

Confirmed with user: instant Draft row (breakdown fills in, no processing tab); **replace** the merchant
review workspace with the cloned customer editor.

## Key insight

`ComponentBreakdownPanel` already does client-side breakdown (`POST /api/ai/breakdown`), shows
"AI 识别中" then populates, and emits `catalogSelections`. Reusing it for the merchant editor gives the
"instant + fills in" behavior for free and drops the server analyze workflow (processing status,
`analyzeMerchantStyleAction`, claim/complete RPCs) from the new-upload path.

## Slices

- **Slice 0 — upload bug fix.** DONE (`merchant-style-actions.ts`).
- **Slice 1 — parameterize `ComponentBreakdownPanel`.** Add `showRemoval?: boolean` (default `true`) and
  a `footer?: ReactNode` slot. Customer call site unchanged (defaults preserve behavior). Merchant passes
  `showRemoval={false}` + a Save/Publish footer. Safe, no behavior change for customer.
- **Slice 2 — merchant edit page on the cloned panel.** A merchant edit view renders the panel
  (`showRemoval={false}`), a title field (seeded from the AI name), and a footer with **Save draft** +
  **Publish** wired to the existing `saveMerchantStyleDraftAction` / `publishMerchantStyleAction` using
  the panel's emitted `breakdown.catalogSelections`. Image base64 for the panel comes from an upload-time
  client store, falling back to fetching the style's preview URL → base64.
- **Slice 3 — instant-draft flow + status.** Upload creates the style as a Draft (`needs_review`) and the
  library shows it immediately (the "Processing" tab becomes "Drafts"). New uploads route to the edit
  page; the panel runs the breakdown client-side. Retire `MerchantStyleReviewWorkspace` once the new
  editor replaces it. (Confirm: leave the server analyze workflow dormant vs remove it.)
- **Slice 4 — tests + docs.** Update merchant styles page/edit tests; update `current-state.md` +
  `implementation-log.md`.

## Risks / open

- **glossary vs catalog ids.** The panel is glossary-based and emits `glossaryId` as `catalogItemId`;
  publish re-derives price/duration server-side from the **catalog** via quoteService. The panel's
  preview price may differ slightly from the published price (published is authoritative). Acceptable for
  demo; the long-standing glossary↔catalog duplication is pre-existing tech debt.
- **Image base64 sourcing** for a stored draft image (private bucket → `privatePreviewUrl` → fetch →
  base64), vs stashing base64 at upload time.
- **Status migration** for any existing `processing` rows (demo data is reseeded, so low risk).
