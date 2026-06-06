# Style-config recognition: error analysis & improvement plan

Date: 2026-06-06
Scope: the 35 demo styles auto-configured by `recognizeStyleConfig` (image -> catalog breakdown +
name + facets), reviewed image-by-image because the demo has no merchant to approve them.
Companion to the implementation-log entry "Manual merchant review of the 35 backfilled styles".

This document is the *why* behind the corrections, so we fix the generation path instead of
re-correcting data forever.

## 1. Error taxonomy (what the AI got wrong)

| # | Error class | Frequency | Concrete example | Impact |
|---|---|---|---|---|
| E1 | `per_set` quantity > 1 | 14 / 35 | french_tip ×10, glitter ×5, cat_eye ×4 | Price inflated up to 10× (8256 `$178`, 8259 `$508`) |
| E2 | `per_finger` counted as raw pieces | ~8 / 35 | rhinestone_small ×22, ×30 | Duration exploded to 6–8 h; price inflated |
| E3 | Absurd `per_piece` count | 1 | metal_charm ×21 | Price + time inflated |
| E4 | Missing base manicure | 1 (8286) | no `basic_manicure_service` | Price below the structural floor (`$20 < $28`) |
| E5 | Under-detection (rich nail -> base only) | 1 (8257) | bejeweled set configured as bare manicure | Style massively under-priced |
| E6 | Element mis-classification | several | painted stars tagged `sticker`; simple stars tagged `pattern_art` (45 min) | Wrong price/time band |
| E7 | False-positive elements | a few | `metal_charm` on a flat-painted nail | Phantom line items |

## 2. Root-cause synthesis

The seven classes collapse into five root causes. Ordered by leverage.

### RC1 — The model does not know catalog *unit semantics* (drives E1, E2, E3)
The breakdown prompt gives the model catalog ids but not what "quantity" *means* per id. A human and
a model both look at a photo and count what they see: "10 fingers have french tips" -> `french_tip ×10`,
"22 small stones" -> `rhinestone_small ×22`. But `french_tip` is priced `per_set` (one application,
qty always 1) and `rhinestone_small` is priced `per_finger` (qty = number of *fingers*, max 10, not
number of stones). The unit is a pricing abstraction the model can't infer from pixels.

This is the single biggest source of error and it is systematic, not random.

### RC2 — Pricing math multiplied price by quantity for *every* unit (amplifies E1, E2, E3)
`deriveSnapshot` (and the backfill path) did `price += unitPrice × quantity` for all units. So a
`per_set` line with the model's bogus qty=10 became 10× price. The unit-error (RC1) and the math-error
compounded: a wrong quantity should have been *harmless* for `per_set` (counted once) but instead
10×'d the bill. Per the agreed rule, only `per_finger` / `per_piece` scale; `per_set` / `fixed` /
`included` / `tag_only` are counted once regardless of quantity.

### RC3 — Structural invariants were AI-dependent instead of guaranteed (drives E4, E5)
`basic_manicure_service` is `ai_detectable = 'no'` — it must be *injected*, never detected. The
`withBaseManicure` helper existed, but 8286 hit a JSON-parse failure and fell through a path that
skipped injection, so it published with no manicure floor. Likewise 8257's parse failure fell back to
"base only" and *published* a clearly-wrong config. Two structural guarantees — "every style has the
base floor" and "a failed recognition never auto-publishes" — were best-effort, not enforced.

### RC4 — Some catalog units mismatch human/AI perception (drives E2, E6)
`rhinestone_small` priced `per_finger` is the worst offender: nobody looks at a nail and counts
"fingers that bear small rhinestones" — they count stones. The unit is correct for *pricing labor*
(applying scattered small stones is priced per finger worked) but fights perception. Overlapping art
categories (`sticker` 10 min vs `hand_paint_simple` 30 min vs `pattern_art` 45 min) are also hard to
tell apart from a photo, so the model lands in the wrong time band (E6).

### RC5 — Per-finger duration scales linearly with no economy of scale (residual long durations)
Even with *correct* counts, `hand_paint_simple` (30 min/finger) × 10 = 300 min, `pattern_art`
(45 min/finger) × 3 = 135 min. Full-coverage art legitimately takes hours, but linear scaling
overstates because it ignores setup/repetition economies. Post-correction, 8280 still derives 259 min
and 8279 196 min — those are model-of-time artifacts, not count errors.

### RC0 (meta) — The demo bypassed the human-in-the-loop safety net
The architecture is "AI suggests by default, merchant edits anything wrong before publishing." The 35
demo styles were seeded with no merchant, so every AI error shipped to `published`. The intended
control existed; the seeding path skipped it. This is why the manual review was necessary at all.

## 3. Improvement plan (layered defense)

No single fix. Defense in depth, cheapest/highest-leverage first.

### Layer 1 — Teach the model (addresses RC1, partially RC4/E6)
Embed per-id unit semantics in the breakdown prompt, derived from the catalog (`defaultPricingUnit`,
`quantitySupported`):
- For each catalog id, state the unit and what quantity means: `per_set` -> "always 1"; `per_finger`
  -> "number of fingers (1–10)"; `per_piece` -> "number of individual pieces".
- For `quantitySupported = 'no'` items, instruct the model to omit quantity entirely.
- Add 1–2 worked examples that disambiguate the traps (scattered small rhinestones -> count fingers,
  not stones; a french tip across all nails -> one `per_set` line).

### Layer 2 — Deterministic parse-time guards (addresses RC1, RC2; partly in progress)
Cheap, deterministic clamps applied after parsing, before persistence. The other agent's per_set +
JSON-schema enforcement covers part of this. Complete the set:
- `per_set` / `fixed` / `included` / `tag_only` -> quantity coerced to 1.
- `per_finger` -> quantity clamped to `[1, 10]`.
- `per_piece` -> quantity clamped to a sane max (propose ≤ 30) and logged when clamped.
- Pricing must respect units (count-once vs scale-by-qty) in **quote-service**, not only in the
  backfill script — verify the canonical pricer, since that is what booking quotes from.

### Layer 3 — Structural invariants (addresses RC3, E4, E5)
- **Unconditional base injection** at persistence: every published style gets `basic_manicure_service`
  regardless of whether the AI path succeeded. Make it a property of `setConfig`/publish, not the AI
  helper.
- **Never auto-publish a failed/empty recognition.** A parse failure or zero priceable selections must
  leave the style in `needs_review`, not fall back to "base only" and publish.

### Layer 4 — Catalog modeling (addresses RC4, RC5; needs a decision -> candidate ADR)
- Reconsider the unit for scatter elements. Either move `rhinestone_small` to `per_piece` (count
  stones, matches perception) or keep `per_finger` and rely on Layer 1/2. Tradeoff: pricing labor vs
  intuitiveness. Decide explicitly.
- Reduce overlapping art categories or make their visual cues distinct, to cut E6.
- Replace linear per-finger duration with a diminishing-returns curve or a per-element max, so
  full-coverage art does not derive 5+ hour jobs.

### Layer 5 — Keep the human in the loop (addresses RC0)
The merchant review UI (list every price/time-bearing item for approve/edit) is the real safety net.
For demo data with no merchant, this manual review *is* that step — and its corrections are now the
authoritative state. Do not `--force` re-run `configure:styles`: it regenerates from raw AI output and
would clobber the reviewed counts.

## 4. Status & ownership

| Improvement | Layer | Status |
|---|---|---|
| per_set = 1 enforcement (parse + quote + DB) | 2 | In progress (other agent) |
| Strict JSON-schema output | 1/2 | In progress (other agent) |
| per_finger `[1,10]` clamp | 2 | Proposed |
| per_piece sane-max clamp | 2 | Proposed |
| Unit semantics in prompt | 1 | Proposed |
| Unconditional base injection | 3 | Proposed |
| No auto-publish on failed recognition | 3 | Proposed |
| Rhinestone unit re-modeling | 4 | Needs ADR |
| Non-linear per-finger duration | 4 | Needs ADR |

## 5. Honest limits of this review
Counting fingers/pieces from a single marketing photo is approximate; the merchant remains ground
truth. The corrections remove the *gross* errors (10× prices, 8 h durations, missing floor) and bring
every style into a plausible band. They are not forensic. That is acceptable: the goal is sane defaults
a merchant can confirm, not pixel-perfect inventory.
