# Graph Report - /home/tough/BT5151 GroupProject  (2026-04-25)

## Corpus Check
- 29 files · ~78,867 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 549 nodes · 863 edges · 66 communities detected
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 151 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]

## God Nodes (most connected - your core abstractions)
1. `Runtime Skill Prompt Loading` - 20 edges
2. `CreditRiskState` - 17 edges
3. `cb_predict()` - 16 edges
4. `load_skill_prompt()` - 16 edges
5. `_record_codegen_snapshot()` - 14 edges
6. `_get_state()` - 12 edges
7. `call_json_response()` - 12 edges
8. `build_eda_report()` - 12 edges
9. `train_models_node()` - 11 edges
10. `main()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `validate_preprocessing_output()` --references--> `Preprocessing Semantic Normalization`  [INFERRED]
  /home/tough/BT5151 GroupProject/src/bt5151_credit_risk/preprocess.py → docs/architecture/current-state.md
- `train_models_node()` --references--> `Class Label Encoding Contract`  [INFERRED]
  /home/tough/BT5151 GroupProject/src/bt5151_credit_risk/graph.py → docs/architecture/current-state.md
- `Runtime Skill Prompt Loading` --references--> `Dataset Policy Skill`  [INFERRED]
  docs/architecture/current-state.md → skills/dataset-policy-spec.md
- `Runtime Skill Prompt Loading` --references--> `Column Transform Spec Skill`  [INFERRED]
  docs/architecture/current-state.md → skills/column-transform-spec.md
- `Runtime Skill Prompt Loading` --references--> `Generate Preprocessing Code Skill`  [INFERRED]
  docs/architecture/current-state.md → skills/generate-preprocessing-code.md

## Hyperedges (group relationships)
- **Preprocessing Contract Loop** — preprocessing_codegen_loop, semantic_role_contract, preprocessing_repair_escalation, role_violation_validator [EXTRACTED 0.90]
- **Feature Engineering Contract Loop** — feature_engineering_loop, feature_views_contract, feature_lineage_replay_contract, deterministic_feature_engineering_mode [EXTRACTED 0.85]
- **XAI to Business Explanation Chain** — four_layer_hypothesis_chain, xai_method_stack, analysis_bundle_contract, run_inference_skill, explain_risk_skill [INFERRED 0.80]
- **Graphify Governance** — graphify_canonical_scope, graphify_exclusion_policy, graphify_maintenance_rules, agents_graphify_usage, claude_graphify_first [EXTRACTED 0.90]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (86): _app_css(), _beeswarm_fig(), _build_action_md(), build_app(), _build_casebook_context_md(), _build_explanation_md(), _build_hypothesis_md(), _build_key_drivers_md() (+78 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (54): choose_best_model(), compute_multiclass_metrics(), reason_model_selection(), deterministic_feature_engineering_fallback_code(), Return conservative FE code that preserves rows and encodes categoricals.      T, build_graph(), _codegen_log_root(), compile_graph() (+46 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (47): Class Label Encoding Contract, _apply_lineage_operation(), _build_fe_artifact_paths(), _build_feature_stats(), _call_fe_codegen_agent(), _eval_formula_ast(), _evaluate_feature_formula(), execute_feature_engineering() (+39 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (43): _apply_inline_bold(), build_pipeline_html(), _build_pipeline_items(), _extract_level(), _extract_message(), _finalise_card(), _format_llm_call_line(), _format_mapping_preview() (+35 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (39): Evaluation Evidence Rule, Analysis Bundle Contract, Audit Preprocessing Skill, Capability Ceiling Escalation, Column Transform Spec Skill, Dataset Policy Skill, Deterministic Model Selection, Evaluate Models Skill (+31 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (29): column_transform_spec_node(), dataset_policy_spec_node(), generate_preprocessing_code_node(), repair_preprocessing_code_node(), review_preprocessing_quality_node(), validate_preprocessing_output_node(), _build_column_profiles(), _build_column_stats() (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (30): _build_provenance_metadata(), _finalize_successful_run(), _log_evaluate(), _log_fe(), _log_full(), _log_outputs(), _log_preprocess(), _log_specs() (+22 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (27): LLM business explanation + recommendation in one reasoning call (~15-20s)., _run_explain_step(), _call_json_agent(), explain_risk(), explain_risk_node(), generate_eda_hypotheses_node(), interpret_global_xai_node(), interpret_local_xai_node() (+19 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (19): build_eda_report(), _build_feature_profiles(), _compute_cardinality(), _compute_categorical_association(), _compute_class_separability(), _compute_correlations(), _compute_discriminative_features(), _compute_missing_patterns() (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (16): BaseModel, list_caches(), load_cache(), Pipeline state cache — serialize and reload trained pipeline artifacts.  After a, Return all named cache files sorted by mtime (newest first)., Load cached pipeline state from path, or CACHE_FILE if path is None.      Return, Serialize pipeline state to CACHE_FILE.      Args:         result: Dict returned, save_cache() (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.24
Nodes (14): build_trace_event_path(), _extract_artifacts(), _extract_metrics(), _extract_warnings(), _flatten_numeric_dict(), _infer_status(), _is_metric_key(), _is_number() (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (12): shortcut_audit_node(), ablate_suspects(), _calendar_match(), detect_shortcut_suspects(), _predict(), Shortcut-feature audit: deterministic verdicts on suspect top-ranked features., Return a copy of `view` with `feature` replaced by its median (numeric)     or 0, Zero-out ablation for up to max_ablations suspects. Returns list of     {feature (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.38
Nodes (11): Classification, classify_paths(), _extract_paths(), flush(), main(), _normalise_path(), paths_from_hook_stdin(), read_recorded_paths() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.3
Nodes (11): cap_credit_history_by_adulthood(), coerce_numeric(), fill_numeric_by_group_then_global(), missing_string_mask(), multi_hot_membership(), parse_age_series(), parse_count_series(), parse_dirty_numeric() (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.46
Nodes (7): _looks_secret_key(), _merge_json(), Persist one codegen attempt in a stable run-scoped folder.      The function is, record_codegen_attempt(), _redact_obvious_secrets(), _strip_private_keys(), _write_json()

### Community 15 - "Community 15"
Cohesion: 0.57
Nodes (6): _add_ratio_features(), _apply_blocked_columns(), engineer_deterministic_feature_views(), _numeric_series(), _safe_ratio(), write_deterministic_feature_artifacts()

### Community 16 - "Community 16"
Cohesion: 0.6
Nodes (3): _is_binary_set(), _unique_non_null(), validate_semantic_roles()

### Community 17 - "Community 17"
Cohesion: 0.4
Nodes (5): Graphify Usage Rules, Documentation Source of Truth, Claude Graphify First Rule, Canonical Graph Scope, Graphify Exclusion Policy

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (1): BT5151 credit risk monitoring package.

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (2): Observability Rule, Developer Trace Artifacts

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (2): Graph as Architecture Map, Not Source Truth, Graphify Maintenance Rules

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (1): Build per-column statistics for the LLM quality reviewer.

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (1): Log per-class counts and warn if any class falls below 5% of total.

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (1): Build per-column statistics for the LLM quality reviewer.

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (1): Per-column statistics for the LLM to reason about transforms.

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (1): Return conservative FE code that preserves rows and encodes categoricals.      T

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (1): Raised when a report formula cannot be safely replayed.

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (1): Extract exact engineered-feature formulas from the FE report.

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (1): Safely evaluate a small arithmetic expression over DataFrame columns.      Suppo

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (1): Build acceptable replay candidates for formulas with documented cleanup.      Ge

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (1): Recompute a derived feature value from its raw inputs. Returns None if     the o

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (1): Replay the declared lineage against the actual engineered train frame.      Retu

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (1): deferred_categoricals: {col_name: nunique} for object-dtype columns in the prepr

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (1): Build per-column statistics for the LLM quality reviewer.

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (1): Build per-column statistics for the LLM quality reviewer.

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (1): Programmatic EDA producing a structured report for downstream LLM nodes.

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (1): Compute mutual information for both numeric and categorical columns.      Catego

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (1): Cramér's V association between each categorical column and the target.      Comp

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (1): Return conservative FE code that preserves rows and encodes categoricals.      T

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (1): Raised when a report formula cannot be safely replayed.

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (1): Extract exact engineered-feature formulas from the FE report.

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (1): Safely evaluate a small arithmetic expression over DataFrame columns.      Suppo

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (1): Build acceptable replay candidates for formulas with documented cleanup.      Ge

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (1): Recompute a derived feature value from its raw inputs. Returns None if     the o

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (1): Replay the declared lineage against the actual engineered train frame.      Retu

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (1): deferred_categoricals: {col_name: nunique} for object-dtype columns in the prepr

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (1): Build per-column statistics for the LLM quality reviewer.

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (1): Log an FE hypothesis dict as per-field lines with bold-friendly labels.

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (1): Return FE-survivable top-MI features only.      Raw EDA may rank identifiers or

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (1): # IMPORTANT: use the same grouped/temporal policy as tuning so the LLM sees

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (1): Per-column statistics for the LLM to reason about transforms.

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (1): Return conservative FE code that preserves rows and encodes categoricals.      T

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (1): Raised when a report formula cannot be safely replayed.

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (1): Extract exact engineered-feature formulas from the FE report.

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (1): Safely evaluate a small arithmetic expression over DataFrame columns.      Suppo

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (1): Build acceptable replay candidates for formulas with documented cleanup.      Ge

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (1): Recompute a derived feature value from its raw inputs. Returns None if     the o

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (1): Replay the declared lineage against the actual engineered train frame.      Retu

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (1): deferred_categoricals: {col_name: nunique} for object-dtype columns in the prepr

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (1): First Principles Design Rules

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (1): Architecture-Aware Change Policy

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (1): LangGraph State Pipeline

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (1): CreditRiskState Contract

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (1): Deterministic Feature Engineering Mode

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (1): Confidence Diagnostics Contract

## Knowledge Gaps
- **185 isolated node(s):** `Run individual pipeline stages for development and debugging.  Each stage runs t`, `Persist post-run artifacts without letting optional failures stall terminal stat`, `Stream node-by-node, accumulating state updates, stop after target node.`, `Log outputs cumulatively — later stages include all earlier outputs.`, `Build the cache provenance metadata dict from run identifiers.` (+180 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 18`** (2 nodes): `__init__.py`, `BT5151 credit risk monitoring package.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (2 nodes): `Observability Rule`, `Developer Trace Artifacts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `Graph as Architecture Map, Not Source Truth`, `Graphify Maintenance Rules`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `config.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `Build per-column statistics for the LLM quality reviewer.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `Log per-class counts and warn if any class falls below 5% of total.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `Build per-column statistics for the LLM quality reviewer.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `Per-column statistics for the LLM to reason about transforms.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `Return conservative FE code that preserves rows and encodes categoricals.      T`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `Raised when a report formula cannot be safely replayed.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `Extract exact engineered-feature formulas from the FE report.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `Safely evaluate a small arithmetic expression over DataFrame columns.      Suppo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `Build acceptable replay candidates for formulas with documented cleanup.      Ge`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `Recompute a derived feature value from its raw inputs. Returns None if     the o`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `Replay the declared lineage against the actual engineered train frame.      Retu`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `deferred_categoricals: {col_name: nunique} for object-dtype columns in the prepr`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `Build per-column statistics for the LLM quality reviewer.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `Build per-column statistics for the LLM quality reviewer.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `Programmatic EDA producing a structured report for downstream LLM nodes.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `Compute mutual information for both numeric and categorical columns.      Catego`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `Cramér's V association between each categorical column and the target.      Comp`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `Return conservative FE code that preserves rows and encodes categoricals.      T`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `Raised when a report formula cannot be safely replayed.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `Extract exact engineered-feature formulas from the FE report.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `Safely evaluate a small arithmetic expression over DataFrame columns.      Suppo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `Build acceptable replay candidates for formulas with documented cleanup.      Ge`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `Recompute a derived feature value from its raw inputs. Returns None if     the o`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `Replay the declared lineage against the actual engineered train frame.      Retu`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `deferred_categoricals: {col_name: nunique} for object-dtype columns in the prepr`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `Build per-column statistics for the LLM quality reviewer.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `Log an FE hypothesis dict as per-field lines with bold-friendly labels.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `Return FE-survivable top-MI features only.      Raw EDA may rank identifiers or`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `# IMPORTANT: use the same grouped/temporal policy as tuning so the LLM sees`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `Per-column statistics for the LLM to reason about transforms.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `Return conservative FE code that preserves rows and encodes categoricals.      T`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `Raised when a report formula cannot be safely replayed.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `Extract exact engineered-feature formulas from the FE report.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `Safely evaluate a small arithmetic expression over DataFrame columns.      Suppo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `Build acceptable replay candidates for formulas with documented cleanup.      Ge`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `Recompute a derived feature value from its raw inputs. Returns None if     the o`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `Replay the declared lineage against the actual engineered train frame.      Retu`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `deferred_categoricals: {col_name: nunique} for object-dtype columns in the prepr`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `First Principles Design Rules`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `Architecture-Aware Change Policy`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `LangGraph State Pipeline`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `CreditRiskState Contract`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `Deterministic Feature Engineering Mode`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `Confidence Diagnostics Contract`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run_inference_node()` connect `Community 1` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `_run_inference_step()` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Why does `validate_preprocessing_output()` connect `Community 5` to `Community 4`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `Runtime Skill Prompt Loading` (e.g. with `Dataset Policy Skill` and `Column Transform Spec Skill`) actually correct?**
  _`Runtime Skill Prompt Loading` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `CreditRiskState` (e.g. with `Pipeline state cache — serialize and reload trained pipeline artifacts.  After a` and `Serialize pipeline state to CACHE_FILE.      Args:         result: Dict returned`) actually correct?**
  _`CreditRiskState` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `load_skill_prompt()` (e.g. with `ValueError` and `generate_dataset_policy_spec()`) actually correct?**
  _`load_skill_prompt()` has 15 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Run individual pipeline stages for development and debugging.  Each stage runs t`, `Persist post-run artifacts without letting optional failures stall terminal stat`, `Stream node-by-node, accumulating state updates, stop after target node.` to the rest of the system?**
  _185 weakly-connected nodes found - possible documentation gaps or missing edges._