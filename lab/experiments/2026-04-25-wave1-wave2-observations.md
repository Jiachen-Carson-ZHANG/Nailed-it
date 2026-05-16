# 2026-04-25 Wave 1 and Wave 2 Observations

## Scope

This note records what we learned so far from the new implementation plan after completing:

1. Wave 1 — codegen observability
2. Wave 2 — leakage-aware EDA

It focuses on real-run behavior, not just unit tests.

## Evidence used

- `lab/logs/stage_preprocess_20260425_034436.log`
- `lab/logs/trace_events_20260425_034436.jsonl`
- `lab/logs/stage_specs_20260425_110138.log`
- `lab/logs/stage_specs_20260425_124151.log`
- `lab/logs/codegen/20260425_034436/...`

## What improved

### 1. Wave 1 observability is real, not just test-covered

The preprocess run `20260425_034436` proved that the new codegen snapshot tree works in practice:

- preprocessing generate/repair attempts were persisted under `lab/logs/codegen/20260425_034436/preprocessing/...`
- FE generate attempts were persisted under `lab/logs/codegen/20260425_034436/feature_engineering/...`
- attempt folders contained the expected artifacts (`generated.py`, `response.json`, `prompt_payload.json`, `metadata.json`, plus execution/validation reports where applicable)
- prompt payload redaction worked

Practical outcome:

- the pipeline is easier to audit after a bad generate/repair loop
- we can now reason from exact artifacts instead of guessing what the model generated

### 2. Wave 2 changed the EDA reasoning surface in the intended direction

The first real specs run (`20260425_110138`) showed leakage alerts during EDA, which did not exist before:

- `Customer_ID` was surfaced as `block/group_column`
- `SSN` and `ID` were surfaced as `block/identifier_column`

This confirms the architecture change is real: EDA is no longer silently treating every high-MI field as equally valid for modeling.

### 3. The new plan is already finding real contract bugs earlier

The first Wave 2 real run immediately exposed two architectural mismatches:

1. `feature_eligibility.py` was reading the wrong leakage policy key
2. the near-unique identifier heuristic was too aggressive for numeric measurements

This is a good sign, not a bad one. The new implementation plan is making hidden contract mismatches visible earlier in the pipeline, where they are cheaper to fix.

## What the first real Wave 2 run taught us

Run: `stage_specs_20260425_110138.log`

### Bug 1 — wrong leakage policy field name

Observed behavior:

- `Name` still appeared in the logged top discriminative features
- the leakage alert for `Name` was only `review/identifier_like_name`
- later, `column-transform-spec` still dropped `Name` explicitly as an identifier

Interpretation:

- the EDA eligibility layer and the dataset-policy contract were not aligned
- the policy skill emits `leakage_policy.columns_to_drop`
- the eligibility helper was still reading legacy `leakage_rules.drop_columns`

Impact:

- model-eligible MI ranking was still contaminated by at least one field that should have been hard-blocked

### Bug 2 — numeric measurements were falsely treated as identifier-like

Observed behavior:

- `Credit_Utilization_Ratio` was flagged as `block/near_unique_identifier_behavior`
- `Monthly_Balance` was flagged the same way

Interpretation:

- the heuristic was using near-unique ratio alone
- this is inappropriate for continuous measurements, where many distinct values are normal

Impact:

- the model-eligible ranking could exclude real numeric signals for the wrong reason

## What the patched real Wave 2 run shows

Run: `stage_specs_20260425_124151.log`

### Confirmed improvements

1. `Name` no longer appears in the model-eligible top discriminative feature list.
2. `Name` is now correctly logged as `block/identifier_column`.
3. `Credit_Utilization_Ratio` is no longer falsely emitted as a leakage alert.
4. `generate-eda-hypotheses` changed materially after the patch:
   - before patch, the run predicted logistic regression would beat XGBoost
   - after patch, the run predicted XGBoost would win

This suggests the cleaner model-eligible ranking is already changing downstream reasoning in a meaningful way.

### Remaining caution

`Monthly_Balance` is still flagged as `block/near_unique_identifier_behavior` in the patched run.

This may still be wrong.

Possible explanations:

1. it is genuinely being treated as a raw string/categorical-like field at EDA time, so the numeric exemption did not apply
2. its near-unique behavior is still too aggressively interpreted as identifier-like

This is not urgent for Wave 2 completion, because `Monthly_Balance` is not in the model-eligible top-10 after the patch. But it is a good candidate for future tightening if we see it distort another run.

## Overall judgment so far

### Wave 1

Successful.

It improved observability in a concrete, operational way. This is already paying off by making codegen and repair runs auditable from disk.

### Wave 2

Successful in direction, with one follow-up hardening pass required.

The architecture is better now because:

- raw MI and model-eligible MI are no longer conflated
- leakage-like high-MI fields are surfaced explicitly as alerts
- real-run verification caught contract mismatches quickly

The patch after the first specs run materially improved the behavior.

## Best current takeaways

1. Real `specs` runs are essential for validating reasoning-surface changes. Unit tests alone would not have caught the policy-key mismatch as quickly.
2. The implementation plan is doing what we wanted: it is moving failures earlier and making them more legible.
3. The combination of Wave 1 + Wave 2 is stronger than either alone:
   - Wave 1 tells us exactly what was generated
   - Wave 2 tells us whether the reasoning inputs are semantically valid for modeling
4. We should continue using this pattern for the next waves:
   - implement
   - add focused tests
   - run a real stage slice
   - write down what the real run taught us

## Recommended next step

Proceed to Wave 3 only after treating the current Wave 2 state as the new baseline:

- keep the patched eligibility logic
- keep real `specs` verification as part of the checklist
- carry forward the observation that heuristic blockers should remain conservative unless policy/spec is explicit
