# 2026-04-25 — Wave 3 semantic cleaning observations

## Run used

- `stage_preprocess_20260425_143722.log`

## What improved

1. The column-spec layer now reasons in terms of the approved primitive vocabulary instead of only free-form cleaning prose.
   - The real run explicitly referenced `parse_age_series`, `parse_dirty_numeric`, `parse_duration_months`, and `cap_credit_history_by_adulthood` in column-transform reasoning.
2. Preprocessing stability improved materially at the hard-contract layer.
   - `generate-preprocessing-code` passed inspection, execution, and deterministic validation on the first attempt.
   - Deterministic normalization logged the expected high-risk families:
     - `Age`
     - `Credit_History_Age`
     - `Type_of_Loan`
3. The `preprocess` stage still reached `train-models` successfully after the Wave 3 changes.
   - Final stop-node run completed in `1202.8s`.
   - FE validation passed.
   - all three candidate models trained.

## What did not fully improve yet

1. Wave 3 did not eliminate preprocessing repair loops completely.
   - The first preprocessing attempt still failed the LLM quality audit, even though structural validation passed.
2. The remaining first-pass quality issues were:
   - `Type_of_Loan`: multi-value encoding still left an `'and'` token artifact
   - `Monthly_Balance`: lower-tail / negative-value distribution still looked suspicious to the audit reviewer
3. One repair pass resolved both issues cleanly.

## Practical interpretation

Wave 3 appears to have improved the **deterministic correctness floor** more than the **first-pass quality ceiling**.

That is still a good result:

- the generate attempt became good enough to execute and validate immediately
- the remaining repair was about quality refinement, not broken artifacts or schema failures
- the stage no longer looked fragile at the preprocessing contract boundary

## Implications for Wave 4

1. The shared primitive library is worth keeping; it reduced contract-level instability.
2. The next leverage point is not another role-taxonomy redesign.
3. The remaining gap is likely in:
   - how multi-value cleaning instructions are translated into codegen
   - how deterministic preprocessing and audit expectations interact for lower-tail financial fields such as `Monthly_Balance`

## Suggested follow-up checks

1. Inspect the Wave 3 preprocessing codegen snapshot for the first attempt in:
   - `lab/logs/codegen/20260425_143722/preprocessing/`
2. Compare the initial generate attempt versus the single repair attempt to see exactly how:
   - `'and'` token cleanup changed for `Type_of_Loan`
   - lower-tail handling changed for `Monthly_Balance`
3. Keep treating real `preprocess` runs as the acceptance gate for future preprocessing-architecture changes.
