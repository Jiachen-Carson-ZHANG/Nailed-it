# 2026-04-25 — Wave 4 batch 2 + Wave 5 observations

## Scope

This batch combined:

1. the last planned Wave 4 quality-tightening step
2. Wave 5 tuning hygiene

The user explicitly asked to avoid another long `preprocess` rerun between these two waves, so this batch was verified with combined regression tests first. The longer integrated run is intentionally deferred until after the Wave 5 code landed.

## Wave 4 batch 2 — what changed

### Problem

The last real `preprocess` run succeeded, but still needed one audit-driven repair for numeric-bound quality issues:

- `Monthly_Inhand_Salary`
- `Total_EMI_per_month`
- `Num_Credit_Inquiries`

That was not a structural failure, but it revealed one missing artifact-boundary rule: if the transform spec already declares numeric bounds, the runtime should enforce them before audit.

### Fix

`normalize_preprocessing_artifacts()` now enforces declared bounds for kept numeric columns using:

- `primitive_params.bounds`
- `primitive_params.lower_bound` / `upper_bound`
- explicit cleaning text patterns such as:
  - `clip to [low, high]`
  - `values < low or > high`

The enforcement happens on both:

- `feature_frame.csv`
- `cleaned_frame.csv`

### Why this is the right shape

This keeps the architecture honest:

- the transform spec remains the source of truth
- the artifact layer enforces declared bounds deterministically
- the audit stays a reviewer, not the first discoverer of already-declared contract violations

## Wave 5 — what changed

### Problem

Tuning was working, but several practical controls were still hard-coded inside `train.py`, and tuning provenance was mostly in memory:

- Optuna trials
- tuning subsample size
- CV fold count
- XGBoost tuning / early-stopping knobs
- RF tuning estimator count

Grid cleanup also existed only as a couple of inline heuristics.

### Fix

Wave 5 added:

- env-backed tuning controls in `config.py`
- deterministic grid sanitization in `train.py`
- persisted tuning artifacts in `lab/logs/tuning/<run_id>/`
- top-level state field `tuning_artifact_path`

The persisted files are:

- `grids.json`
- `trial_history.json`
- `summary.json`

## What improved

### 1. Wave 4 is now cleaner to reason about

The remaining preprocessing repair gap is narrower now:

- semantic contracts already lived in deterministic code
- deterministic FE already became reusable
- now spec-declared numeric bounds are also enforced deterministically before audit

That means the audit should be spending less time rediscovering obvious clipping issues.

### 2. Tuning is more controllable without code edits

You can now strengthen or cheapen tuning from environment variables rather than editing Python constants.

That matters because tuning is exactly the kind of thing that should be configurable, not re-patched into source every time we want to compare runs.

### 3. Tuning is more auditable

Before this batch, trial history mainly lived in state. Now tuning has a stable run-scoped artifact location under `lab/logs/tuning/<run_id>/`.

That makes it much easier to compare:

- what the LLM proposed
- what the sanitized grid actually became
- what Optuna tried
- what won

## Verification

Combined regression verification for the touched subsystems:

- `PYTHONPATH=src .venv/bin/python3 -m pytest tests/test_preprocess.py tests/test_train.py tests/test_graph.py tests/test_state.py -q`
- result: `75 passed in 18.54s`

## Honest boundary

This batch did **not** rerun the long integrated pipeline slice yet.

That was intentional and matches the requested sequence:

1. finish Wave 4
2. land Wave 5
3. then run the bigger integrated proof afterward

So the code and tests are in a good state, but the next meaningful check is still a real run after both waves, not just more unit tests.

## Recommendation for the next step

Now that Wave 4 and Wave 5 are both landed, the next useful move is one integrated run that answers all three questions together:

1. does preprocessing now avoid the previous audit repair more often?
2. do tuning artifacts appear correctly under `lab/logs/tuning/<run_id>/`?
3. does the end-to-end pipeline still hold under the new tuning/config surface?
