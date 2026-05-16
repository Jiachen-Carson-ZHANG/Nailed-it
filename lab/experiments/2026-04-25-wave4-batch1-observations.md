# 2026-04-25 — Wave 4 Batch 1 observations

## Scope

Wave 4 batch 1 focused on three architectural hardening steps:

1. extract preprocessing contract logic into `src/bt5151_credit_risk/schema_contracts.py`
2. extract deterministic feature engineering into `src/bt5151_credit_risk/deterministic_fe.py`
3. harden FE subprocess imports so generated code can import repo helpers without depending on shell-level `PYTHONPATH`

## What improved

### 1. Preprocessing contract logic is now a real module, not a giant local blob

- `preprocess.py` now delegates semantic-role validation and cross-field invariant checks to `schema_contracts.py`
- the extraction did **not** change behavior: the broader Wave 4 verification stayed green
- this makes the contract layer easier to test and harder to fork accidentally

### 2. Deterministic FE is now a reusable library, not only inline generated code

- `deterministic_fe.py` now owns the conservative production FE path
- the extracted deterministic FE path:
  - preserves validated preprocessing columns
  - blocks dropped / leakage / identifier columns before FE
  - adds 3 conservative ratio features when parents exist:
    - `EMI_to_Salary_Ratio`
    - `Debt_to_Income_Ratio`
    - `Balance_to_Salary_Ratio`
  - one-hot encodes deferred categoricals
  - writes the normal FE artifacts plus lineage/report files

### 3. FE subprocess importability is now explicit

- `execute_feature_engineering()` now injects repo `src/` into `sys.path` and subprocess `PYTHONPATH`
- generated FE code can import stable helpers such as `bt5151_credit_risk.semantic_cleaning` even if the parent shell did not export `PYTHONPATH=src`
- this closes a brittle execution-path gap before any future FE extraction work goes deeper

### 4. FE validation now guards against blocked-column resurrection

- `validate_feature_engineering_output()` now rejects engineered outputs that reintroduce columns explicitly dropped/quarantined by the preprocessing spec
- this is important because contract drift can otherwise hide inside FE even when preprocessing was correct

## Verification

### Focused / broad tests

- `PYTHONPATH=src .venv/bin/python3 -m pytest tests/test_schema_contracts.py tests/test_deterministic_fe.py tests/test_feature_engineering.py tests/test_graph.py tests/test_preprocess.py -q`
- result: `72 passed in 26.22s`

### Real pipeline slice

- command:
  - `PYTHONPATH=src .venv/bin/python3 run_stage.py preprocess`
- result:
  - completed successfully as `lab/logs/stage_preprocess_20260425_151420.log`
  - reached `train-models` and exited cleanly at the configured stop node

## Real-run observations

### Strongest positive signal

The batch held end to end on a real run:

- preprocessing generated code executed successfully on attempt 1
- validation passed with deterministic normalization still active
- one audit-driven preprocessing repair remained, but it was a quality refinement on clipping bounds, not a structural artifact failure
- deterministic FE executed successfully on attempt 1
- FE validation passed
- training completed and the stage exited cleanly

### Concrete FE result from the real run

The deterministic FE path produced:

- 54 output features
- 3 deferred-categorical encodings:
  - `Occupation`
  - `Payment_of_Min_Amount`
  - `Payment_Behaviour`
- 3 conservative ratio features:
  - `EMI_to_Salary_Ratio`
  - `Debt_to_Income_Ratio`
  - `Balance_to_Salary_Ratio`

### Training baseline from the real run

Grouped-entity CV baseline / tuned results in `stage_preprocess_20260425_151420.log`:

- logistic regression best CV: `0.6376`
- random forest best CV: `0.6722`
- xgboost best CV: `0.6736`

These numbers are not the point of Wave 4 batch 1, but they confirm the extracted deterministic FE path remains compatible with the training stack.

## What did not improve yet

Wave 4 batch 1 did **not** remove preprocessing audit repairs completely.

The remaining repair in the real run was still:

- `Monthly_Inhand_Salary` clipping / bound enforcement
- `Total_EMI_per_month` tail handling
- `Num_Credit_Inquiries` tail handling

That means the next friction is still in preprocessing quality alignment, not in the extracted contract module or deterministic FE architecture.

## Bottom line

Wave 4 batch 1 is a real architectural improvement, not just a refactor-on-paper:

- contract logic is modularized
- deterministic FE is reusable and testable
- FE importability is explicit
- blocked columns are defended at FE validation
- the real `preprocess` stage still closes end to end

The next useful move is to keep Wave 4 focused on contract and FE hardening, while treating the remaining preprocessing audit repair as a separate quality-tightening thread rather than evidence that this extraction failed.
