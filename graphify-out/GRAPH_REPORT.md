# Graph Report - Nailed-it  (2026-05-19)

## Corpus Check
- 10 files · ~4,595 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 81 nodes · 92 edges · 10 communities (7 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d4b20a19`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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

## God Nodes (most connected - your core abstractions)
1. `main()` - 7 edges
2. `ADR 0002: Commit Graphify Report and Manifest Only` - 7 edges
3. `flush()` - 6 edges
4. `Graphify Ingestion Policy` - 6 edges
5. `check_stale()` - 5 edges
6. `status_text()` - 5 edges
7. `hooks` - 4 edges
8. `_normalise_path()` - 4 edges
9. `read_recorded_paths()` - 4 edges
10. `record_paths()` - 4 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (10 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.27
Nodes (16): check_stale(), Classification, classify_paths(), _extract_paths(), flush(), _graphify_update_command(), main(), _manifest_entries() (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (14): Cache and memory rules, Change policy, Definition of done, Documentation rules, Documentation usage rules, Eval rules, graphify, Guide the design, step back when needed to find more ideas that often beat the current design (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (13): Change policy, Core Principle: Guide the design, step back when needed to find more ideas that often beat the current design, Definition of done, Documentation rules, Documentation usage rules, Eval rules, graphify, Observability rules (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.25
Nodes (7): hooks, PostToolUse, PreToolUse, Stop, permissions, defaultMode, includeCoAuthoredBy

### Community 4 - "Community 4"
Cohesion: 0.25
Nodes (7): ADR 0002: Commit Graphify Report and Manifest Only, Alternatives considered, Consequences, Context, Decision, Design principles, References

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (6): Agent Usage, Canonical Graph Scope, Exclusions, Graphify Ingestion Policy, Maintenance Rules, Shared Artifacts

### Community 6 - "Community 6"
Cohesion: 0.40
Nodes (4): Architecture: Current State, Key modules, LLM integration, Pipeline

## Knowledge Gaps
- **49 isolated node(s):** `defaultMode`, `includeCoAuthoredBy`, `PreToolUse`, `PostToolUse`, `Stop` (+44 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `defaultMode`, `includeCoAuthoredBy`, `PreToolUse` to the rest of the system?**
  _49 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._