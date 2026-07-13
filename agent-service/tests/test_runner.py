"""Tests for the OpenRouter backend's manual tool-call loop (runner._run_openrouter) — the riskiest
new code. A fake OpenAI client returns a tool_call then a final message; we assert the loop executes
the real tool body, records the transcript, and returns the final text. Network-free."""
from types import SimpleNamespace

import pytest

from nailed_agents import bus, config, runner, tools


def _msg(content, tool_calls=None, usage=None):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content, tool_calls=tool_calls))],
        usage=usage or SimpleNamespace(prompt_tokens=100, completion_tokens=20, cost=0.0005),
    )


def _tool_call(call_id, name, arguments):
    return SimpleNamespace(id=call_id, type="function",
                           function=SimpleNamespace(name=name, arguments=arguments))


def test_openrouter_loop_executes_tool_then_returns_final_text(monkeypatch):
    # provider = openrouter, and capture the tool's side-effect write
    monkeypatch.setattr(config, "MODEL_PROVIDER", "openrouter")
    monkeypatch.setattr(config, "AGENT_MODEL", "google/gemini-2.5-flash")
    writes = []
    monkeypatch.setattr(bus, "write_action", lambda sb, **kw: writes.append(kw))
    # place_ad now creates a REAL StyleAd campaign through the TS route (ADR-0012); stub that hop.
    monkeypatch.setattr(bus, "post_propose_ad", lambda *a, **k: {"ok": True, "id": "ad-s-1", "status": "active"})
    monkeypatch.setattr(bus, "fetch_decisions", lambda: {})  # hypothesis hop (ADR-0015) — offline
    monkeypatch.setattr(bus, "fetch_campaign_outcomes", lambda sb, m: [])  # wallet check (ADR-0016) — offline
    monkeypatch.setattr(config, "MARKETING_BUDGET_CENTS", 18000)

    # fake client: 1st turn → call place_ad; 2nd turn → final text, no tool_calls
    responses = iter([
        _msg("", [_tool_call("c1", "place_ad", '{"style_id":"s-1","audience":"try_on_no_booking","total_budget_cents":16000,"duration_days":4}')]),
        _msg("Placed the ad."),
    ])
    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(
        create=lambda **kw: next(responses))))
    monkeypatch.setattr(runner, "_openai", lambda: fake)

    ctx = tools.RunContext(sb=object(), run_id="run-x", merchant_id="m-x")
    final = runner.run_agent(system="sys", tool_names=["place_ad"], task="go", ctx=ctx)

    assert final == "Placed the ad."
    # usage accounting: 2 API calls' tokens + measured cost accumulated onto the context
    assert ctx.usage["api_calls"] == 2 and ctx.usage["prompt_tokens"] == 200
    assert abs(ctx.usage["cost_usd"] - 0.001) < 1e-9 and ctx.usage["seconds"] >= 0
    # the real place_ad body ran → one captured action write
    assert len(writes) == 1 and writes[0]["action_type"] == "place_ad"
    assert writes[0]["payload"]["styleId"] == "s-1" and writes[0]["payload"]["totalBudgetCents"] == 16000
    # ADR-0012: the action links FORWARD to the real campaign it created, and mirrors its live state.
    assert writes[0]["entity_type"] == "style_ad" and writes[0]["entity_id"] == "ad-s-1"
    assert writes[0]["status"] == "applied"  # budget within the auto-launch cap → campaign is active
    # transcript order: tool's tool_call + action (from the body), then the final reasoning text
    assert [s["kind"] for s in ctx.transcript] == ["tool_call", "action", "reasoning"]
    # the attempt recorder logged the successful call (name + parsed args + ok), for the eval gate
    assert ctx.tool_attempts == [{"tool": "place_ad",
                                  "args": {"style_id": "s-1", "audience": "try_on_no_booking", "total_budget_cents": 16000, "duration_days": 4},
                                  "status": "ok", "error": None}]


def test_openrouter_loop_no_tool_call_just_returns_text(monkeypatch):
    monkeypatch.setattr(config, "MODEL_PROVIDER", "openrouter")
    monkeypatch.setattr(config, "AGENT_MODEL", "x")
    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(
        create=lambda **kw: _msg("just reasoning, no tools"))))
    monkeypatch.setattr(runner, "_openai", lambda: fake)

    ctx = tools.RunContext(sb=object(), run_id="run-y", merchant_id="m-y")
    final = runner.run_agent(system="sys", tool_names=["get_merchant_insights"], task="t", ctx=ctx)
    assert final == "just reasoning, no tools"
    assert [s["kind"] for s in ctx.transcript] == ["reasoning"]


def test_openrouter_loop_feeds_tool_errors_back_instead_of_crashing(monkeypatch):
    """A bad tool arg must not crash the loop — the error string is fed back to the model."""
    monkeypatch.setattr(config, "MODEL_PROVIDER", "openrouter")
    monkeypatch.setattr(config, "AGENT_MODEL", "x")
    monkeypatch.setattr(bus, "write_action", lambda sb, **kw: None)
    sent_tool_results = []

    def create(**kw):
        # record any tool-result messages the loop fed back
        for m in kw["messages"]:
            if m.get("role") == "tool":
                sent_tool_results.append(m["content"])
        # first call has no prior tool result → emit a bad call; second call → finish
        if not sent_tool_results:
            return _msg("", [_tool_call("c1", "place_ad", '{"bad":"args"}')])  # missing required params
        return _msg("recovered")

    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(runner, "_openai", lambda: fake)

    ctx = tools.RunContext(sb=object(), run_id="run-z", merchant_id="m-z")
    final = runner.run_agent(system="sys", tool_names=["place_ad"], task="t", ctx=ctx)
    assert final == "recovered"
    assert any("error" in r for r in sent_tool_results)  # the error was surfaced to the model
    # the invalid-arg attempt is recorded as an error (so the tool-call gate sees it)
    assert ctx.tool_attempts and ctx.tool_attempts[0]["tool"] == "place_ad" and ctx.tool_attempts[0]["status"] == "error"


def test_openrouter_loop_retries_dead_response_even_after_midloop_narration(monkeypatch):
    """A dead response (no content, no tool calls) AFTER the model has narrated mid-loop must still
    trigger the one retry — the stale narration is not a conclusion. Observed live: 决策 narrated
    between tool calls, gemini returned an empty response, and the run ended on the narration."""
    monkeypatch.setattr(config, "MODEL_PROVIDER", "openrouter")
    monkeypatch.setattr(config, "AGENT_MODEL", "x")
    monkeypatch.setattr(bus, "fetch_briefing", lambda range_days=7: {"insights": {}})
    responses = iter([
        _msg("我先查看数据。", [_tool_call("c1", "get_merchant_insights", '{"range_days":7}')]),
        _msg(None),            # dead response mid-loop — must retry, not conclude on the narration
        _msg("最终结论：本轮无需行动。"),
    ])
    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **kw: next(responses))))
    monkeypatch.setattr(runner, "_openai", lambda: fake)

    ctx = tools.RunContext(sb=object(), run_id="run-d", merchant_id="m-d")
    final = runner.run_agent(system="s", tool_names=["get_merchant_insights"], task="t", ctx=ctx)
    assert final == "最终结论：本轮无需行动。"


def test_openrouter_off_allowlist_tool_is_not_executed(monkeypatch):
    """A tool name the model returns that is NOT in the agent's allow-list must NOT run — recorded as an
    off_allowlist error, no side effect (guards the critical allow-list-enforcement fix)."""
    monkeypatch.setattr(config, "MODEL_PROVIDER", "openrouter")
    monkeypatch.setattr(config, "AGENT_MODEL", "x")
    writes = []
    monkeypatch.setattr(bus, "write_action", lambda sb, **kw: writes.append(kw))
    responses = iter([
        _msg("", [_tool_call("c1", "delist_style", '{"style_id":"s-9"}')]),  # NOT in the allow-list below
        _msg("done"),
    ])
    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **kw: next(responses))))
    monkeypatch.setattr(runner, "_openai", lambda: fake)

    ctx = tools.RunContext(sb=object(), run_id="run-a", merchant_id="m-a")
    final = runner.run_agent(system="s", tool_names=["place_ad"], task="t", ctx=ctx)
    assert final == "done"
    assert writes == []  # delist_style never executed → no side effect
    att = ctx.tool_attempts[0]
    assert att["tool"] == "delist_style" and att["status"] == "error" and att["error"] == "off_allowlist"
