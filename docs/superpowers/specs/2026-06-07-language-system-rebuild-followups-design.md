# Language System Rebuild Follow-ups Design

**Date:** 2026-06-07

## Goal

Patch the current app-localization implementation so the customer home, booking upload surface, messages history display, merchant calendar, and profile language switcher all deliver a complete Chinese and English experience within the existing language system.

This follow-up only targets the app experience and does not change the landing page.

## Confirmed Scope Decisions

The following decisions were confirmed during brainstorming and are fixed for implementation:

- "Home page" means the customer app home at `/customer/home`
- The landing page remains out of scope
- Language switch entry points are changed only on the customer and merchant profile pages
- The language switcher becomes a collapsed entry button that expands on click
- The switcher is moved above the `Privacy Policy` block on both profile pages
- Merchant calendar changes are limited to visible UI copy only
- Booking upload copy changes are limited to the explicitly requested button and helper labels
- Existing message history must display Chinese in Chinese mode and English in English mode
- The existing shared i18n runtime remains the foundation; no parallel localization system is introduced

## Problems To Fix

### 1. Profile Language Switcher UX

The current language switcher works functionally, but its interaction and placement do not match the requested UX:

- It is always expanded
- It appears above the booking-history or analytics section rather than close to the account utilities
- It does not behave like a compact settings entry

### 2. Chinese Copy Gaps In Customer Home

The customer home still contains English or Chinese-first hardcoded content outside the shared message dictionaries, especially in the trending area and top CTA.

Required Chinese adjustments:

- `Trending` -> `热门`
- `Saves` -> `收藏夹`
- `Refresh` -> `刷新`
- Top CTA `新的美甲设计` -> `+上传款式`

### 3. Booking Upload Surface Copy Gaps

The booking upload experience still mixes hardcoded and dictionary-based copy.

Required Chinese adjustments:

- `Upload or take photo` -> `上传或拍照`
- `Try on this look` -> `试戴款式`
- `分析我的照片` -> `AI识别`

### 4. Message History Content Is Not Language-Aware

The messages pages already localize page chrome, but the historical thread content still comes from English-only seed or system-generated strings. This creates mixed-language output in Chinese mode.

The display requirement is:

- Chinese mode shows Chinese historical messages
- English mode shows English historical messages

### 5. Merchant Calendar Visible UI Copy Is Not Localized

The merchant calendar page and calendar schedule component still render visible UI copy in English only.

This includes:

- Page heading and subtitle
- View toggles
- Legend/status labels
- Empty states and helper copy
- Capacity labels and per-day display hints

This follow-up explicitly does **not** change the underlying booking data model or non-UI business contracts for calendar items.

### 6. Merchant Profile Label Refinement

The merchant profile section title `技师工作负载` needs to become `美甲师管理` in Chinese mode, while keeping the English side consistent with the same information architecture.

## Architecture Approach

This work extends the current localization system rather than redesigning it.

Implementation follows three rules:

- Reuse the existing `LanguageProvider`, storage, and message dictionary structure
- Move newly requested fixed UI strings into the shared UI message dictionaries whenever the copy is true UI chrome
- For message-history content that is effectively seeded or templated content, introduce a language-aware display mapping at the presentation boundary instead of leaving raw English strings in Chinese mode

This keeps the architecture aligned with the original rebuild design and avoids one-off hardcoded fixes.

## Detailed Design

## 1. Profile Switcher Interaction

The profile pages keep the language switcher as the only switch surface for each role, but the component changes from an always-open two-button row into a stacked disclosure pattern.

Expected behavior:

- The default state shows a single entry button with the current language label
- Clicking the button expands a small stacked menu
- The expanded menu shows `中文` and `English`
- Selecting a language switches immediately and collapses the menu
- The whole switcher block sits directly above the `Privacy Policy` button on both profile pages

Implementation principle:

- The reusable switcher component should own the collapsed/expanded interaction so both roles stay identical
- The profile pages should control only placement, not internal switcher mechanics

## 2. Customer Home Copy

Customer home text should be localized through the shared UI messages where practical.

Required visible Chinese mode output includes:

- Home trending section title: `热门`
- Save section label: `收藏夹`
- Refresh action: `刷新`
- Top CTA: `+上传款式`

English mode should continue to show the English equivalents.

Because the customer home already uses a provider-backed app shell, these updates should be consumed through `useLanguage()` and dictionary keys rather than component-local string branching wherever the text is true UI chrome.

## 3. Booking Upload Copy

The booking upload surface should preserve the existing flow but change the visible Chinese labels requested by the user.

Required visible output:

- Upload entry label becomes `上传或拍照`
- Post-upload action becomes `试戴款式`
- Recognition trigger becomes `AI识别`

Implementation principle:

- If the text is a reusable UI label, place it in the UI dictionaries
- If the control already uses `t(...)`, update the source message key rather than adding conditional inline copy
- English mode remains unchanged unless a related message key currently uses incorrect wording

## 4. Messages History Display

This is the only part of the scope where the visible content is not just UI chrome.

The existing message pages already localize headings, loading states, and composer labels. The missing piece is the message-history content itself. For this follow-up, the right solution is a display-layer mapping that supports bilingual seeded/system content without rewriting the whole conversation persistence contract.

Recommended display strategy:

- Seeded conversation fixtures store bilingual variants for historical system messages and booking-time strings where needed
- Conversation-to-view mapping selects the language-appropriate visible content before rendering
- Existing live user-authored free text remains unchanged unless it already has a bilingual source

This keeps the scope focused on "current project message history display" rather than a broader multilingual conversation-storage redesign.

## 5. Merchant Calendar UI

Merchant calendar should become fully usable in Chinese and English at the UI level.

Visible strings to localize include:

- Page eyebrow, title, subtitle
- `Month` / `Day` style toggles
- Calendar day helper labels such as capacity or availability text
- Status copy such as `open`, `almost full`, `full`
- Empty states and no-booking helper copy
- Any visible confirmation hint tied to pending bookings

Implementation principle:

- These strings should come from the same UI dictionary layer as other fixed UI copy
- Date values and counts should stay data-driven, but their labels and wrappers must follow the current language
- Do not broaden this task into changing the deeper booking domain or server data contracts for calendar rows

## 6. Merchant Profile Title Update

The merchant profile section currently named `技师工作负载` should change to `美甲师管理` in Chinese mode.

The English side should remain a clear management-oriented label rather than a literal "workload" translation if that better matches the section's actual content.

Implementation principle:

- Update the merchant profile page copy source
- Keep the downstream roster card title prop language-aware
- Update tests to assert the new Chinese text

## Testing Strategy

## Functional Checks

- Customer profile switcher expands and collapses correctly
- Merchant profile switcher expands and collapses correctly
- Switching language on either profile page updates that role's current UI immediately
- Customer and merchant language preferences remain isolated

## Copy Regression Checks

- Customer home shows `热门`, `收藏夹`, `刷新`, and `+上传款式` in Chinese mode
- Booking upload shows `上传或拍照`, `试戴款式`, and `AI识别` in Chinese mode
- Messages history displays Chinese historical text in Chinese mode and English historical text in English mode
- Merchant calendar visible UI renders in Chinese mode without stray English chrome
- Merchant profile shows `美甲师管理` in Chinese mode

## Non-Regression Checks

- Existing English mode remains intact
- Existing booking, style, manage, messages, and profile flows continue to pass current localization tests
- Landing page files remain untouched

## Risks And Guardrails

### Risk: One-Off Inline Copy Branches

If the fixes are applied as scattered inline conditionals, the app will regress into a mixed localization strategy.

Guardrail:

- Prefer message keys for fixed UI strings and keep language-aware display mapping localized to seeded/history content only

### Risk: Over-Scoping Message Storage

Trying to redesign all conversation persistence as fully bilingual would expand this patch unnecessarily.

Guardrail:

- Limit this follow-up to the existing visible message history and seeded/system display path

### Risk: Calendar Scope Creep

The request says merchant calendar "全部", but the clarified scope is visible UI copy only.

Guardrail:

- Do not refactor booking domain models or server-side calendar contracts as part of this patch

## Acceptance Criteria

This follow-up is complete only when all of the following are true:

- Customer and merchant profile pages show a collapsed language switcher above `Privacy Policy`
- Expanding the switcher reveals Chinese and English options, and selection works for the current role
- Customer home Chinese mode shows `热门`, `收藏夹`, `刷新`, and `+上传款式`
- Booking upload Chinese mode shows `上传或拍照`, `试戴款式`, and `AI识别`
- Existing message history appears in Chinese in Chinese mode and English in English mode
- Merchant calendar visible UI is localized in both languages
- Merchant profile Chinese mode shows `美甲师管理`
- Landing page remains untouched
