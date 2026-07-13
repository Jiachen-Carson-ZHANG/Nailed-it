# Technical Documentation — Nailed-it

Judge-facing engineering documentation. Each document explains **what we built, what we rejected, and
why** — every design claim cites the code path or the measured evidence behind it. The ADRs in
`docs/decisions/` are the raw decision records; these documents are the synthesized, readable account.

| Doc | Question it answers |
|---|---|
| [01 — System overview](01-system-overview.md) | What is the system, end to end? |
| [02 — Multi-agent architecture](02-multi-agent-architecture.md) | Why is this a real agent team and not a pipeline with extra steps? |
| [03 — Decision brain & economics](03-decision-brain-and-economics.md) | Where do the numbers come from, and why doesn't the LLM compute them? |
| [04 — Action contract & safety](04-action-contract-and-safety.md) | Why should a merchant trust an AI that spends money? |
| [05 — Memory, feedback & the revision edge](05-memory-feedback-revision.md) | What does the team learn, and how do agents push back on each other? |
| [06 — Evaluation methodology](06-evaluation-methodology.md) | How do we know any of it works? |
| [07 — Anticipated judge Q&A](07-judge-qa.md) | The hard questions, answered before they're asked |
| [08 — Demo walkthrough: agent I/O & contracts](08-demo-walkthrough-agent-io.md) | The real round, agent by agent: inputs, outputs, tool usage, JSON contracts, the envelope |
| [09 — 模型选型报告](09-模型选型报告.md) | 用我方评测框架实测选定基座模型：矩阵、指标、评分、方法、决策依据（中文，评委版） |

Reading order for a 15-minute review: 01 → 02 → 07. For the live-demo script: 08. For model selection: 09.
