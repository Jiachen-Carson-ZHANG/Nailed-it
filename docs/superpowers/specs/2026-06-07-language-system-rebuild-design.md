# Language System Rebuild Design

**Date:** 2026-06-07

## Goal

Rebuild the app's user-facing language system so the product fully supports Simplified Chinese and English across customer and merchant experiences, defaults to Chinese, and lets each role switch language independently from its own profile page.

This design covers:

- All user-facing UI and UX copy in the app shell and product flows
- Business-facing visible content such as style names, descriptions, glossary labels, and pricing-related labels
- AI-generated explanatory text that the user sees
- Locale-aware money, date, unit, status, and accessibility copy

This design explicitly does **not** cover the landing page.

## Product Decisions

The following product decisions were validated during brainstorming and are treated as fixed for implementation:

- The language preference is stored separately for `customer` and `merchant`
- The default language is `zh-CN`
- Chinese uses `CNY` with the `¥` symbol by default
- English uses `SGD` with the `$` symbol by default
- Both Chinese and English must be complete, product-ready experiences
- Missing translations are not an accepted steady-state product strategy
- AI-generated user-visible text must follow the current language
- Implementation will be phased, but the architecture should be designed once and remain consistent across phases

## Scope

### In Scope

- Shared app language runtime and persistence
- Customer flows, starting with booking and style
- Merchant flows, starting with manage
- Profile-based language switch entry points for both roles
- Messages and profile pages in a later implementation phase
- Shared components, domain display contracts, mock data, seed-like fixtures, and tests affected by localization
- Accessibility strings such as `aria-label`, `alt`, and screen-reader-only guidance
- Loading, empty, validation, and error states

### Out of Scope

- Landing page localization
- URL-based locale routing
- Per-browser auto-detection, geo-detection, or Accept-Language negotiation
- A fallback product mode where one language is allowed to remain incomplete

## Current-State Findings

The current codebase already shows why this rebuild needs to cover both UI copy and business content together:

- There is no unified i18n runtime today
- UI copy is hardcoded in components and is already mixed between Chinese and English
- Core business display models are Chinese-first in multiple places, such as `CatalogItem.nameZh`
- AI prompts explicitly ask for Chinese output in several flows, including style naming, recognition notes, and image validation errors
- Customer and merchant profile pages already exist and are natural switch-entry points

Because of this, localizing only component chrome would still leave broken English experiences in style content, pricing breakdowns, and AI summaries.

## Architecture Overview

The rebuild should be organized into four layers so the system stays clear and maintainable.

### 1. Language State Layer

Provide a shared language runtime that stores the selected language independently for each role.

Responsibilities:

- Resolve the current role-specific language
- Default to `zh-CN`
- Persist `customer` and `merchant` preferences separately
- Expose runtime switching from profile pages
- Update the current app session immediately when the user switches language

Recommended persistence keys:

- `customer-language`
- `merchant-language`

### 2. UI Message Layer

All fixed UI copy should move into structured translation dictionaries and stop being hardcoded inside components.

Examples:

- Page titles and subtitles
- Buttons, links, tabs, helper text, placeholders
- Empty states, validation messages, loading copy, error messages
- Status display labels
- Accessibility labels such as `aria-label` and `alt`

This layer should use stable keys such as:

- `booking.upload.title`
- `booking.result.analyzeButton`
- `manage.pricing.empty`
- `profile.language.switch`

### 3. Localized Domain Content Layer

Business content that users see must not be treated as ordinary UI copy. It should move to bilingual domain fields rather than ad hoc translation maps.

Recommended shape:

```ts
type LocalizedText = {
  zh: string;
  en: string;
};
```

Recommended usage:

```ts
type LocalizedDescriptiveFields = {
  name: LocalizedText;
  description?: LocalizedText;
  notes?: LocalizedText;
};
```

This layer should cover:

- Catalog items
- Glossary items
- Style names and descriptions
- Pricing and breakdown display labels
- Merchant-manage visible business descriptions
- Future merchant-authored visible content where applicable

### 4. Formatting and AI Output Layer

All dynamic language-sensitive rendering should flow through shared formatters and AI language contracts.

Responsibilities:

- Format money based on current language defaults
- Format dates, durations, counts, and pricing units
- Map stable enum/status ids to localized display labels
- Ensure AI-generated text is produced in the current language
- Prevent component-level string concatenation for money and units

## Runtime Design

## Language Resolution

The app should use a role-aware language source with this precedence:

1. The current role's explicit persisted preference
2. Default `zh-CN`

No route-level locale parameter is required for this phase.

## Provider Design

Introduce a shared language provider that can be used from both server and client code, while keeping the APIs small and composable.

Recommended responsibilities:

- `language`: current language
- `role`: current app role
- `t(key)`: resolve UI messages
- `pickLocalizedText(value)`: pick localized domain content
- `formatMoney(value)`: render money using the language's default currency
- `formatDate(value)`: render dates appropriately
- Additional helpers for units, statuses, and counts

Because the app already mixes server and client components, the implementation should expose:

- A server-friendly message lookup and formatting path
- A client-friendly context hook for interactive components

That keeps server pages like style detail routes locale-aware without forcing unnecessary client migration.

## Profile Switching Experience

Each role's profile page becomes the switch surface for that role only.

Customer profile:

- Shows a language switch control
- Updates `customer-language`
- Immediately re-renders the customer experience in the new language

Merchant profile:

- Shows a language switch control
- Updates `merchant-language`
- Immediately re-renders the merchant experience in the new language

Changing one role's language must not affect the other role.

## Data Model Design

## Translation Categories

To avoid mixing concerns, translatable content should be handled in three categories.

### A. UI Copy

Managed entirely by keyed message dictionaries.

Examples:

- Buttons
- Labels
- Helper text
- Toasts
- Screen titles
- Empty and error states

### B. Domain Content

Stored as bilingual fields on business entities or business-facing display records.

Examples:

- Catalog item names
- Glossary item names and type labels
- Style names
- Style descriptions
- Merchant-manage business descriptions

### C. Stable Enums with Localized Display

Internal values remain stable English ids, but display strings are localized through mappings.

Examples:

- Booking status values like `pending_review`, `confirmed`, `cancelled`
- Pricing units such as `per_finger`, `per_piece`, `fixed`
- Nail shape, style tag, and complexity ids

This keeps logic stable while making output bilingual.

## Target Data Upgrades

The following current areas are expected to need bilingual upgrades or localized display seams:

- `src/domain/catalog.ts` and any catalog-backed display consumers
- Glossary-backed breakdown display records in the nail analysis flow
- Style records that currently store only one visible name/description
- Mock style definitions and catalog/glossary seed data
- Merchant style auto-config output where names and descriptions are generated
- Any UI-level helper that currently assumes a single visible language

## Translation Asset Strategy

Use two main translation asset categories.

### UI Message Assets

Recommended structure:

- `messages/ui/zh-CN.ts`
- `messages/ui/en.ts`

These files own:

- UI text
- Status labels
- Error text
- Accessibility text
- Shared formatting labels such as duration/unit descriptors

### Domain Translation Assets

Business content translations should live with the data contracts or strongly associated source data rather than in generic UI message files.

Examples:

- Catalog and glossary mock data upgraded to bilingual fields
- Style seed data upgraded to bilingual fields
- Merchant-facing preset business descriptions upgraded to bilingual fields

This makes it easier to audit missing business translations separately from UI messages.

## AI and Recognition Design

AI-generated text must follow the current language, but not all AI output should be treated the same way.

## Fixed Non-AI Messages

Messages such as loading, validation, general errors, and fixed helper copy should stay in the normal UI translation dictionaries.

## Free-Generated AI Text

These fields should become explicitly language-aware:

- Style naming output in `recognizeStyleName`
- Style description output in merchant style auto-config
- Recognition notes like `otherNotes`
- Image validation errors currently requested in Chinese

Implementation principle:

- Prompts should explicitly request the target language
- Persisted user-visible AI text should be stored as bilingual content whenever practical, rather than only storing the currently requested language

This matters because switching language later should not require a fresh AI call just to re-render existing records.

## Money, Units, and Formatting Rules

The implementation should centralize display formatting so components do not manually assemble localized text.

Rules:

- `zh-CN` defaults to `CNY` and shows `¥`
- `en` defaults to `SGD` and shows `$`
- Duration should localize, for example `分钟` vs `min`
- Pricing units should localize, for example `每指` vs `per finger`
- Dates should be formatted according to the current language's conventions
- Status badges and analytics labels should be localized from stable ids

Components should never manually build money strings like `"¥" + price`.

## Missing Translation Policy

The product goal is full bilingual completeness. That means fallback display cannot be the official product strategy.

Recommended policy:

- Development: expose missing keys or missing bilingual fields loudly
- Test: fail key module tests when required translations are missing
- Production: allow minimal protective fallback only if necessary to avoid a hard crash, and log it for follow-up

This keeps the team honest without making the UI brittle.

## Delivery Phases

The architecture is designed once, but implementation is phased to manage risk and support translation review.

### Phase 0: Foundations

Implement the shared language runtime before broad feature rewiring:

- Role-specific persistence
- Provider and helpers
- Message dictionary structure
- Money/date/unit/status formatting helpers
- Missing-translation detection
- Profile switch UI for both roles

### Phase 1: Booking, Style, and Manage

This is the first feature wave and the primary validation surface for the architecture.

Customer booking:

- Upload flow
- Recognition results
- Step indicators
- Quote and confirm display
- Validation and error copy

Customer style:

- Style detail page
- Style description
- Breakdown labels
- Quote display

Merchant manage:

- Pricing rules
- Service labels and descriptions
- Style management visible business copy
- Analysis workspace user-facing copy

This phase also upgrades the corresponding domain data to bilingual fields.

### Phase 2: Messages and Profile

After the first wave stabilizes, expand to:

- Message list and conversation screens
- Message empty/loading/error states
- Profile statistics and links
- Switch-adjacent supporting UI

### Phase 3: AI, Fixtures, and Test Completion

Finalize the system by aligning infrastructure around the new contracts:

- AI prompts and outputs
- Mock data and seeded fixtures
- Test assertions
- Missing translation coverage checks
- Formatting consistency verification

## Translation Review Workflow

The user requested that missing content first be auto-translated and then reviewed in batches. The implementation should support that workflow directly.

Recommended review artifacts per phase:

### 1. UI Copy Review Sheet

Grouped by module and containing:

- Translation key
- Chinese copy
- English copy

### 2. Domain Content Review Sheet

Grouped by content type and containing:

- Stable id
- Chinese value
- English value
- Content source/type

### 3. AI Output Contract Review Sheet

Listing fields such as:

- Recognition notes
- Style names
- Style descriptions
- Validation errors

Each phase should be translated automatically first, then reviewed by the user before the connected feature work is considered complete.

## Testing Strategy

## Functional Tests

- Customer language switching works independently
- Merchant language switching works independently
- Default language is Chinese
- Preferences persist across refreshes for each role

## Content Completeness Tests

- Booking, style, manage, messages, and profile pages have no missing visible translations in their target phases
- Business-facing visible content has both Chinese and English values
- AI-generated visible content follows the current language
- No page renders mixed-language copy as its steady-state output

## Formatting Tests

- Chinese money defaults to `CNY ¥`
- English money defaults to `SGD $`
- Dates, durations, units, and statuses localize correctly
- Components do not hand-roll money formatting

## Regression Tests

- Landing page remains untouched
- Existing behavior outside localized display remains stable
- Key screen tests can assert localized output by current language rather than fixed hardcoded English-only copy

## Acceptance Criteria

The feature is complete only when all of the following are true:

- Customer and merchant can each switch languages from their own profile pages
- Both roles default to Chinese before a preference is chosen
- Booking, style, manage, messages, and profile flows are fully usable in both languages
- Business content such as style names, descriptions, glossary labels, and pricing labels is complete in both languages
- AI-generated user-visible text follows the selected language
- Chinese money defaults to `CNY ¥`
- English money defaults to `SGD $`
- No implementation work touches the landing page
- Translation review happens in batches before each module wave is considered done

## Risks and Guardrails

### Risk: UI Localization Without Domain Localization

If only UI chrome is localized, the app will still present incomplete English experiences in styles, breakdowns, and AI summaries.

Guardrail:

- Treat UI and business content as separate but equally required localization tracks

### Risk: Prompt-Level Drift

AI prompts currently contain language assumptions. If only the UI layer changes, generated text will remain Chinese and feel broken in English mode.

Guardrail:

- Audit and update all user-visible AI prompt outputs as part of the language rebuild

### Risk: Silent Translation Gaps

If missing translations quietly fall back in development, gaps will survive into production.

Guardrail:

- Make missing translations obvious in development and enforce checks in tests

### Risk: Route-Level Scope Explosion

A locale-in-URL strategy would expand scope significantly and could drag in the landing page.

Guardrail:

- Keep this rebuild as an app-runtime localization system, not a route architecture rewrite

## Non-Negotiable Constraints

- Do not localize the landing page in this project
- Do not introduce URL-based locale routing in this phase
- Do not accept a temporary product strategy where UI is translated but business-visible content remains single-language

