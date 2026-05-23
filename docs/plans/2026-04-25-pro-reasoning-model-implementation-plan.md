# 2026-04-25 Pro Reasoning Model Implementation Plan

## Status

Approved implementation plan.

This document is the execution-ready version of the earlier `Pro reasoning model advice.md` note. It keeps the useful ideas, removes the parts that conflict with the current architecture, and defines a practical wave-by-wave rollout.

## Goal

Improve reliability and debuggability of the pipeline without introducing a second architecture.

The main objectives are:

1. Make preprocessing and FE codegen attempts fully observable.
2. Prevent identifier-like leakage from contaminating EDA and downstream reasoning.
3. Replace fragile ad hoc cleaning logic with reusable deterministic primitives.
4. Strengthen deterministic FE, which is already the production default.
5. Improve tuning hygiene without making the LLM responsible for numeric search.

## Non-Goals

These are explicitly out of scope for wave 1:

1. Replacing the current 12-role `semantic_role` taxonomy.
2. Introducing a second preprocessing contract engine with a competing schema.
3. Making threshold tuning part of the default evaluation or inference policy.
4. Replacing deterministic FE as the default path.

## Locked Assumptions

These assumptions must remain true during implementation:

1. Keep the current 12-role `semantic_role` taxonomy and extend it additively with fields such as `primitive`, `primitive_params`, and optionally `semantic_subtype`.
2. Use review-first leakage heuristics. Hard blocking should come from explicit policy/spec, leakage roles, target/group roles, `action=drop` or `quarantine`, and strong near-unique identifier behavior.
3. Consolidate existing preprocessing validators rather than introducing a second contract system.
4. Integrate codegen snapshots into the current trace and UI path instead of creating a separate observability island.
5. Fix FE subprocess importability before generated wrappers import repo modules.
6. Treat threshold tuning as a later experiment behind a feature flag.

## Wave 1 - Codegen Observability

### Outcome

Every preprocessing and FE generation / repair attempt is persisted in a stable, run-scoped folder and is visible through the existing trace pipeline.

### Scope

1. Add `src/bt5151_credit_risk/codegen_audit.py`.
2. Snapshot every preprocessing and FE generate/repair attempt under:
   - `lab/logs/codegen/<run_id>/preprocessing/...`
   - `lab/logs/codegen/<run_id>/feature_engineering/...`
3. Persist:
   - `generated.py`
   - `response.json`
   - `prompt_payload.json`
   - `metadata.json`
   - `execution_log.json`
   - `validation_report.json`
   - `audit_report.json` where applicable
4. Add top-level state fields so trace/UI can surface them directly:
   - `preprocessing_codegen_snapshot_path`
   - `feature_engineering_codegen_snapshot_path`
5. Keep nested metadata too if useful for internal routing.

### Files

1. `src/bt5151_credit_risk/codegen_audit.py`
2. `src/bt5151_credit_risk/preprocess.py`
3. `src/bt5151_credit_risk/feature_engineering.py`
4. `src/bt5151_credit_risk/graph.py`
5. `src/bt5151_credit_risk/state.py`

### Success Criteria

1. Every attempt has a stable on-disk snapshot.
2. Snapshot paths appear in trace artifacts without adding a parallel observability system.
3. Redaction removes obvious secrets from prompt payload snapshots.
4. Existing code execution and repair behavior is unchanged apart from observability.

## Wave 2 - Leakage-Aware EDA

### Outcome

EDA preserves raw discriminative signals for audit, while downstream reasoning uses only model-eligible signals.

### Scope

1. Add `src/bt5151_credit_risk/feature_eligibility.py`.
2. Produce both:
   - `raw_top_discriminative_features`
   - `model_eligible_top_discriminative_features`
3. Keep `top_discriminative_features` as the backward-compatible model-eligible key.
4. Add `leakage_alerts` for blocked or suspicious high-MI fields.
5. Update prompts so modeling hypotheses use model-eligible MI only.

### Heuristic Policy

1. Explicit dataset policy and transform spec remain authoritative.
2. Near-unique identifier behavior can hard-block.
3. Regex/name heuristics should usually create alerts or `review_*` states, not unconditional hard blocks.

### Files

1. `src/bt5151_credit_risk/feature_eligibility.py`
2. `src/bt5151_credit_risk/eda.py`
3. `src/bt5151_credit_risk/graph.py`
4. `skills/generate-eda-hypotheses.md`
5. `skills/column-transform-spec.md`
6. `skills/generate-feature-engineering-code.md`
7. `skills/reason-model-selection.md`

### Success Criteria

1. EDA no longer feeds identifier-like columns into modeling hypotheses as positive signals.
2. Leakage warnings are still visible for audit.
3. Existing FE validation safety net remains in place as a backstop.

## Wave 3 - Semantic Cleaning Primitives

### Outcome

Dirty parsing moves from fragile one-off LLM-written regex into reusable deterministic primitives while preserving the current semantic-role contract.

### Scope

1. Add `src/bt5151_credit_risk/semantic_cleaning.py`.
2. Implement reusable primitives for:
   - dirty numeric parsing
   - money parsing
   - age parsing
   - count parsing
   - rate parsing
   - duration-to-months parsing
   - missing-string handling
   - multi-value splitting / multi-hot encoding
   - group-then-global imputation
3. Refactor current deterministic normalization in preprocessing to call these primitives.
4. Add `allowed_cleaning_primitives` into preprocessing codegen and repair payloads.
5. Update prompts so generated preprocessing prefers these primitives when applicable.

### Important Rule

Do not replace `semantic_role`.

Instead, extend the transform schema with additive fields such as:

1. `primitive`
2. `primitive_params`
3. optional `semantic_subtype`
4. richer `contract` metadata where useful

### Files

1. `src/bt5151_credit_risk/semantic_cleaning.py`
2. `src/bt5151_credit_risk/preprocess.py`
3. `skills/column-transform-spec.md`
4. `skills/generate-preprocessing-code.md`
5. `skills/repair-preprocessing-code.md`

### Success Criteria

1. Existing role-based validation still works.
2. Repeated preprocessing repair failures decrease.
3. Codegen prompts have a more deterministic library of allowed cleaning operations.

## Wave 4 - Contract Consolidation and Deterministic FE Hardening

### Outcome

The current validators are reorganized into a cleaner contract layer, and deterministic FE becomes easier to test and harder to break.

### Scope

1. Add `src/bt5151_credit_risk/schema_contracts.py`.
2. Refactor existing generic frame checks, semantic-role checks, and semantic invariants into a cleaner internal structure.
3. Do not create a second contract engine or competing violation schema.
4. Extract deterministic FE logic into `src/bt5151_credit_risk/deterministic_fe.py`.
5. Keep deterministic FE as the production default.
6. Fix FE subprocess importability first:
   - either inject repo `src/` into `sys.path` in the runner
   - or pass `PYTHONPATH` explicitly into the subprocess
7. Add conservative ratio features only when inputs exist and lineage is explicit.
8. Prevent blocked columns from being reintroduced by FE outputs.

### Files

1. `src/bt5151_credit_risk/schema_contracts.py`
2. `src/bt5151_credit_risk/preprocess.py`
3. `src/bt5151_credit_risk/deterministic_fe.py`
4. `src/bt5151_credit_risk/feature_engineering.py`
5. `src/bt5151_credit_risk/graph.py`

### Success Criteria

1. There is one coherent preprocessing contract system.
2. Deterministic FE can be unit-tested without relying on subprocess execution.
3. FE cannot silently reintroduce blocked identifier/leakage columns.

## Wave 5 - Tuning Hygiene

### Outcome

Training remains deterministic and policy-aware, but tuning becomes easier to control and audit.

### Scope

1. Move hard-coded tuning knobs into config/env:
   - Optuna trials
   - XGBoost early-stopping and estimator settings
   - tuning subsample cap
2. Add deterministic grid sanitization before Optuna search.
3. Persist tuning trial history artifacts under `lab/logs/tuning/<run_id>/`.

### Files

1. `src/bt5151_credit_risk/config.py`
2. `src/bt5151_credit_risk/train.py`
3. optional packaging/logging integration in `graph.py`

### Success Criteria

1. Default behavior remains unchanged.
2. Stronger tuning can be enabled via env vars without code edits.
3. Trial history is persisted for run-to-run comparison.

## Deferred Experimental Wave - Threshold Tuning

This is explicitly deferred until the earlier waves are stable.

### Why Deferred

1. It changes the evaluation surface.
2. It changes inference policy.
3. It complicates apples-to-apples comparison against current argmax-based runs.

### Rule

If implemented later, it must be behind a feature flag and compared against the argmax baseline.

## Validation Sequence

After each wave, stop and verify the smallest proving command rather than jumping straight to a full long run.

### After Wave 1

Run:

```bash
PYTHONPATH=src python run_stage.py preprocess
```

Check:

1. Codegen attempt folders exist.
2. Snapshot paths appear in trace artifacts / Developer Trace.

### After Wave 2

Run:

```bash
PYTHONPATH=src python run_stage.py specs
```

Check:

1. `raw_top_discriminative_features` preserves raw MI.
2. `top_discriminative_features` is model-eligible.
3. Leakage warnings are visible but do not drive modeling hypotheses.

### After Wave 3

Run:

```bash
PYTHONPATH=src python run_stage.py preprocess
```

Check:

1. Fewer repeated preprocessing repair loops.
2. Prompts reference the cleaning primitive list.

### After Wave 4

Run:

```bash
PYTHONPATH=src python run_stage.py evaluate
```

Check:

1. Deterministic FE remains stable.
2. Blocked columns cannot reappear in FE outputs.
3. Contract violations are consolidated, not duplicated.

### After Wave 5

Run baseline:

```bash
PYTHONPATH=src python run_stage.py evaluate
```

Run stronger XGBoost tuning:

```bash
BT5151_OPTUNA_TRIALS_XGBOOST=30 \
BT5151_OPTUNA_TRIALS_RANDOM_FOREST=15 \
PYTHONPATH=src python run_stage.py evaluate
```

Check:

1. Trial history is persisted.
2. Macro-F1 / Standard recall / confusion matrix are comparable across runs.

## Final Implementation Order

1. Implement codegen observability and trace integration.
2. Implement leakage-aware EDA.
3. Add semantic cleaning primitives under the existing role contract.
4. Consolidate preprocessing contracts.
5. Harden deterministic FE and fix subprocess importability.
6. Improve tuning hygiene.
7. Defer threshold tuning behind a flag.

## Expected Visible Improvements

1. Every generated and repaired script becomes readable and traceable by run and attempt.
2. Identifier-like leakage stops distorting EDA and downstream reasoning.
3. Dirty parsing becomes more deterministic and less repair-loop dependent.
4. Deterministic FE becomes easier to trust and audit.
5. Tuning becomes easier to control and compare without making the LLM the final search authority.
