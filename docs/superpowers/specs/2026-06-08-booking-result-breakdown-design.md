# Booking Result Breakdown Design

**Date:** 2026-06-08

## Goal

Adjust the booking recognition result breakdown UI so the recognized nail structure, shape, and visual effect sections match the requested editing behavior and preserve the existing result-page flow.

This change targets the shared `ComponentBreakdownPanel` used by the customer booking result page and the merchant style editor.

## Confirmed Scope Decisions

The following decisions were confirmed during brainstorming and are fixed for implementation:

- The implementation follows the current panel architecture and does not redesign the result page
- The work is limited to `ComponentBreakdownPanel` state seeding, grouping, and disclosure interaction
- `Extension` recognition should auto-select both `Builder Gel` and `Half Cover Nail Tip`
- The `Nail Shape / Color` section becomes `Nail Shape`
- The new `Nail Shape` section keeps only `nail shape` and `nail length`
- The new `Nail Shape` section reuses the existing "lit chips + `+N` expand more" interaction
- `Base Color` moves from the old `Nail Shape / Color` block into `Style Effects > Color Effects`
- `Color Effects`, `Art Effects`, and `Decoration Effects` must support independent expanded state and stay open until the same section is clicked again
- No new page, modal, or alternative picker pattern is introduced

## Problems To Fix

### 1. Extension Recognition Does Not Seed Required Dependencies

When the AI breakdown recognizes an extension-related result, the current panel does not automatically reflect the expected dependent selections. The requested behavior is that recognizing `Extension` should immediately light up:

- `Builder Gel`
- `Half Cover Nail Tip`

Without this dependency seeding, the result page looks incomplete and the customer needs to manually recover selections that should already be implied by the recognized structure.

### 2. Nail Shape And Color Grouping Is Overloaded

The current `Nail Shape / Color` section mixes four subgroups and classification headers that are heavier than the requested experience. The target UI should instead focus only on the shape-related signals:

- Section title becomes `Nail Shape`
- Keep only `nail shape` and `nail length`
- Remove the subgroup classification treatment inside this section
- Show active chips first
- Collapse the remaining inactive options behind the existing `+N` expansion affordance

This keeps the section focused on the most useful shape decisions while preserving the current compact interaction model.

### 3. Base Color Lives In The Wrong Visual Bucket

`Base Color` currently appears under the old `Nail Shape / Color` section, but it belongs to the visual effect interpretation of the style. The requested behavior is to move it under `Style Effects > Color Effects` so all color-oriented visual signals appear in one place.

### 4. Effect Disclosure State Forces Single-Open Behavior

The current `Style Effects` interaction collapses one section when another section opens. This makes it hard to compare or edit multiple effect groups in one pass. The requested behavior is:

- Clicking a closed effect section opens it
- Opening one section does not close the others
- Clicking an already open section closes that same section

This changes the disclosure model from single-open accordion behavior to independent toggle panels.

## Architecture Approach

This work should stay inside the existing breakdown panel composition rather than introducing a new view-model layer.

Implementation follows four rules:

- Normalize seeded chip state close to `seedStateFromBreakdown()` so AI-returned breakdown data maps into the requested dependent UI state
- Recompose the visible groups in `ComponentBreakdownPanel` without changing the underlying catalog taxonomy
- Reuse the current chip rendering utilities and "show more" interaction instead of inventing a new picker
- Replace the single active disclosure key with independent open-state tracking for the three effect groups

This keeps the patch small, focused, and aligned with the shared panel that already powers both customer and merchant flows.

## Detailed Design

## 1. Structure Dependency Seeding

The structure area already stores selections as a set of catalog IDs. The safest change is to enrich the seeded structure IDs after parsing the AI breakdown result and before the IDs are committed to component state.

Expected rule:

- If the seeded structure contains the extension signal used by the current result mapping, automatically add `builder_gel`
- The same rule also automatically adds `nail_tip_half_cover`

Design constraints:

- The rule should run only during state seeding from recognized or saved breakdown data
- The rule should not forcibly re-add chips after a user manually deselects them during editing
- The rule should work for both the customer booking result page and merchant editor hydration because both reuse the same panel seeding path

## 2. Nail Shape Section Restructure

The section currently derived from multiple category buckets should be simplified at the rendering layer.

Target output:

- Section title: `Nail Shape`
- Visible content includes only the `nail shape` chips and the `nail length` chips
- No internal category headings such as color-specific or mixed classification labels
- Chips already selected by the AI or user stay visible in the primary row
- Remaining unselected options are hidden behind the existing `+N` disclosure and revealed using the same interaction pattern already used elsewhere in the panel

Implementation principle:

- Preserve the existing `ChipGroup` contract where possible
- Use the existing ordering rule that prioritizes selected chips before overflow
- Keep shape and length as separate chip groups for clarity, but keep them under one `Nail Shape` section without the old section-level classification model

## 3. Base Color Rehoming Into Color Effects

`Base Color` should be removed from the old shape/color composition and appended to the `Color Effects` surface in `Style Effects`.

Target behavior:

- `Color Effects` includes the current color-effect chip group and the former base-color chip group
- The moved `Base Color` content still supports its current multi-select behavior
- Existing selected base colors remain visible after hydration or refresh

Implementation principle:

- Reuse the existing `colorIds` state and catalog mapping
- Move only the rendering location, not the underlying catalog IDs or pricing linkage
- Keep the copy clear enough that users can still distinguish "effect type" chips from "base color" chips within the same expanded effect bucket

## 4. Independent Effect Disclosure State

The three effect buckets should stop behaving like a mutually exclusive accordion and instead behave like independent toggles.

Required interaction:

- Closed section click: open the clicked section
- Open section click: close the clicked section
- Opening one section leaves all other open sections unchanged

State model:

- Replace the single active disclosure value with a set-like or map-based state keyed by effect section ID
- The rendering logic reads whether each section is currently open
- The toggle handler adds or removes only the clicked section key

This model keeps the UI predictable and matches the requested "stay open until I click again" behavior.

## Testing Strategy

## Functional Checks

- A breakdown result that includes extension-related structure seeds `Builder Gel` and `Half Cover Nail Tip`
- Manually deselecting those implied structure chips after hydration remains possible
- The `Nail Shape` section renders only `nail shape` and `nail length`
- Selected shape and length chips remain visible before overflow options
- Clicking the `+N` affordance in `Nail Shape` reveals the remaining shape or length options using the existing interaction pattern
- `Base Color` no longer appears in the old shape section and appears inside `Color Effects`
- `Color Effects`, `Art Effects`, and `Decoration Effects` can all remain open at the same time
- Clicking an open effect section closes only that section

## Regression Checks

- Customer booking result page still loads and saves breakdown changes
- Merchant style editor still hydrates and edits the shared breakdown panel
- Quote-related breakdown state still serializes through `buildBreakdownResult()`
- Existing catalog IDs and quantity editing remain unchanged

## Risks And Guardrails

### Risk: Over-Coupling To A Specific AI Label

If the dependency rule keys off a brittle display label instead of a stable catalog ID, future AI mapping changes could silently break the behavior.

Guardrail:

- Implement the dependency using stable internal IDs already used by the structure state

### Risk: Rendering Move Breaks Persisted Breakdown Semantics

Moving `Base Color` visually without preserving its original state wiring could cause saved breakdowns to disappear or serialize incorrectly.

Guardrail:

- Keep the existing `colorIds` state and breakdown serialization contract unchanged
- Limit the change to section composition and presentation

### Risk: Shared Panel Side Effects In Merchant Editor

Because the same panel is reused in merchant editing, any result-page-oriented patch can unintentionally alter that workflow.

Guardrail:

- Keep changes generic to the shared panel contract
- Verify the merchant editor still renders the simplified section structure without broken interactions

## Acceptance Criteria

This change is complete only when all of the following are true:

- Recognized extension results automatically light up `Builder Gel` and `Half Cover Nail Tip`
- The former `Nail Shape / Color` section is renamed to `Nail Shape`
- The new `Nail Shape` section keeps only `nail shape` and `nail length`
- Unselected shape and length options are hidden behind the existing `+N` expand-more behavior
- `Base Color` is rendered inside `Style Effects > Color Effects`
- Opening `Color Effects` does not collapse `Art Effects` or `Decoration Effects`
- Each effect section closes only when the same section is clicked again
- The customer booking result page and merchant style editor both continue to function with the shared panel
