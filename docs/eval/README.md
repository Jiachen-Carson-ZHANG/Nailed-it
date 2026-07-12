# Evaluation — index

All evaluation docs for the project. **The decision is ADR-0010** (`docs/decisions/ADR-0010-evaluation-methodology.md`);
these are the detailed methodology, reports, and specs it points to. Method aligns to GB/T 45288.2-2025.

| Doc | Type | Covers |
|---|---|---|
| [2026-07-01-trend-matching-design.md](2026-07-01-trend-matching-design.md) | design | the RAG matcher being evaluated: VLM concept → hybrid embed→rerank (VS tags/CLIP), pgvector, tradeoffs |
| [2026-07-01-trend-matching-eval-report.md](2026-07-01-trend-matching-eval-report.md) | eval report (RAG) | model-selection study: gold set, IR metrics (Recall/MRR/nDCG/P@1), results (Google embed + Cohere rerank), MTEB corroboration, GB/T alignment, upgrade roadmap. Mentor-facing. |
| [2026-07-01-multiagent-eval-framework.md](2026-07-01-multiagent-eval-framework.md) | eval framework (agents) | eval-first spec: 评测对象拆解, capability matrix (指令遵循/幻觉/稳定性/…), test-set sources, base-model selection via BFCL, judging routing, transcript closed-loop |

Two **separate** suites (retrieval IR metrics vs agentic capability metrics) — shared methodology only.

Related: ADR-0008 (model choice via this method), ADR-0009 (synthetic data = the agent test set),
ADR-0006 (grounded intelligence), ADR-0007 (agent team). Framework knowledge base: memory `reference_llm_eval_framework`.
