# Content Style — Nailed-it

Date: 2026-05-26
Owner: Carson (final say) · Claude (drafts)

Voice, tone, banned words, formatting for every user-visible string. Language: **English (v1)**. Revisit pre-launch.

## Voice

Three adjectives, in priority order:

1. **Brief.** Average sentence ≤ 14 words. Many ≤ 8.
2. **Warm.** Speak like a friend who works in a salon, not a corporate FAQ.
3. **Confident.** Don't apologize, hedge, or stack qualifiers. The app knows what to do — say it.

## Tone modifiers per surface

| Surface | Tone |
|---|---|
| Customer discovery / home | Light, inviting. Trend-aware. |
| Customer booking | Practical, fast. "Tap, done." |
| Customer confirm | Reassuring. State the commitment plainly. |
| Customer post-book | Calm, brief. Just the facts. |
| Customer error | Helpful, never blame. Always offer next step. |
| Merchant calendar | Dense, no-nonsense. Auntie Wang's vocabulary. |
| Merchant manage | Direct. Numbers and actions, not prose. |
| Merchant error | Operational. Tell her what to do. |
| Privacy / Terms | Plain. No legalese unless required. |

## Banned words & phrases

Hard ban in user-visible strings. Lint rule will enforce.

| Banned | Why | Use instead |
|---|---|---|
| flow | Engineering term | step / journey / path |
| contract | Engineering term | (rephrase or drop) |
| mock | Internal | sample / example |
| snapshot | Internal | summary / view |
| source of truth | Internal | (drop entirely) |
| live preview | Vague | preview / instant quote |
| recognition (verb/noun for AI) | Internal | style detection / what we detected |
| AI breakdown | Internal | style details / quote breakdown |
| draft | Engineering | in-progress / unsaved |
| seamlessly | Marketing filler | (drop) |
| effortlessly | Marketing filler | (drop) |
| revolutionary | Marketing filler | (drop) |
| empower | Corporate cliché | help / let / make it easy |
| leverage (verb) | Corporate cliché | use |
| utilize | Verbose | use |
| obtain | Verbose | get |
| commence | Verbose | start |
| ensure | Vague | (rewrite for specificity) |
| in order to | Verbose | to |
| at this time | Verbose | now |
| please note | Filler | (drop) |
| we apologize | Wrong tone | (rewrite — say what you'll do, not how sorry) |

Add to this list whenever an audit catches a recurring offender.

## Capitalization

- **Sentence case** for everything user-facing. NOT Title Case.
  - Right: "Book this look"
  - Wrong: "Book This Look"
- Exception: brand name "Nailed-it" capitalized as shown.
- Buttons: sentence case.
- Page titles: sentence case.
- Section headers: sentence case.

## Punctuation

- No trailing periods on:
  - Button labels.
  - Single-sentence headings.
  - Chip / tag labels.
- Trailing periods on:
  - Body paragraphs.
  - Multi-sentence helper text.
- Em-dash (—) for asides, not hyphen (-).
- Ellipsis only for loading states ("Detecting style…"), never for "etc."
- Curly quotes ("") in prose, straight quotes ("") in code.

## Numbers, currency, time

- **Currency:** prefix with SGD or ¥ depending on locale. v1: SGD for English copy.
  - Right: `SGD 158`
  - Wrong: `158 SGD`, `$158`
- **Time of day:** 24h with leading zero. `10:00`, `14:30`. (Mira persona prefers; Yuki also reads.)
- **Duration:** `min` not `minutes`. `90 min`. `1h 30 min` only if > 60 min.
- **Numbers ≤ 10:** spell out in prose ("three slots left"), but **always digits** in UI (chips, labels, prices).
  - UI label: `3 slots left`.
  - Prose body: "We found three nearby salons."
- **Decimals:** prices never show `.00`. `SGD 158` not `SGD 158.00`.

## Helper text patterns

- **Disabled CTA reason:** start with "Add", "Pick", "Choose" — imperative on what's missing.
  - Right: "Add a photo above to get your quote."
  - Wrong: "You need to upload a photo first."
- **Empty state:** state the situation, then the next step.
  - Right: "No trending styles right now — check back soon."
  - Right: "No bookings yet. Upload a photo to get started."
  - Wrong: "Nothing here."
- **Error recovery:** never start with "Sorry" or "Error". Start with what to do.
  - Right: "Upload didn't go through. Try again, or use a smaller photo."
  - Wrong: "Sorry, an error occurred."
- **Loading:** present tense -ing verb, ≤ 3 words. End with ellipsis.
  - Right: "Detecting style…"
  - Wrong: "Loading…" (too vague)

## CTA labels

- **Verb-led, persona-specific.**
  - Right: "Book this look", "Pick a time", "Confirm appointment"
  - Wrong: "Submit", "OK", "Next" (Submit is the worst — never use).
- **One primary CTA per screen.** Secondary CTAs styled subordinate.
- **Length:** ≤ 3 words for primary, ≤ 5 for secondary.

## Pronouns

- **You** for the user. Never "the user", "users", "customers" in copy.
  - Right: "Your booking is confirmed."
  - Wrong: "The customer's booking is confirmed."
- **We** sparingly, for the product brand voice.
  - Right: "We detected these details" (with restraint).
  - Better: "Here's what we detected." Or just: "Style details."

## Emoji

- **None in product UI.** Exception: empty/error illustrations and onboarding moments only, with Carson approval.
- Status icons: use icon font / SVG, not emoji.
- Internal docs (this file, PATCHES.md, etc.) may use emoji freely.

## Brand-specific terms

| Concept | Term we use | Term we avoid |
|---|---|---|
| AI quote feature | "instant quote" or "style quote" | "AI recognition", "smart recognition", "AI analysis" |
| The picture you upload | "your photo" or "your nail photo" | "image", "reference", "asset" |
| Detected style attributes | "style details" or "what we detected" | "attributes", "recognition result" |
| Booking | "appointment" (post-confirm) or "booking" (pre-confirm) | "reservation", "session" |
| Salon / merchant | "salon" (customer surface), "your shop" (merchant surface) | "merchant", "vendor", "store" |
| Technician | "technician" | "tech", "artist", "operator" |
| Cancellation | "cancel" / "reschedule" | "void", "withdraw" |

## Length caps

- **Button label:** ≤ 3 words primary, ≤ 5 secondary.
- **Page title (h1):** ≤ 8 words.
- **Eyebrow above title:** ≤ 4 words.
- **Body sentence:** ≤ 14 words.
- **Helper text under button:** ≤ 8 words.
- **Empty state body:** ≤ 14 words total across all sentences.
- **Toast message:** ≤ 10 words.

Anything over → rewrite.

## Lint enforcement

Phase 5 ships a script: `scripts/banned-word-lint.sh`.

Regex pattern matches any banned word in:
- `src/**/*.{ts,tsx}` user-visible string literals.
- `src/**/*.{ts,tsx}` JSX text children.

Comments and code identifiers excluded. Fails CI if any match.

## Review process

Copy changes that swap a banned word for an approved alternative → Claude self-merges.

Copy changes that introduce **new** brand terminology, **new** voice direction, or change tone modifier → @carson approval thread before merge.
