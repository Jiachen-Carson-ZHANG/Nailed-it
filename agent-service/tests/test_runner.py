"""Tests for the OpenRouter backend's manual tool-call loop (runner._run_openrouter) — the riskiest
new code. A fake OpenAI client returns a tool_call then a final message; we assert the loop executes
the real tool body, records the transcript, and returns the final text. Network-free."""
from types import SimpleNamespace

import pytest

from nailed_agents import bus, config, runner, tools


def _msg(content, tool_calls=None):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content, tool_calls=tool_calls))])


def _tool_call(call_id, name, arguments):
    return SimpleNamespace(id=call_id, type="function",
                           function=SimpleNamespace(name=name, arguments=arguments))


def test_openrouter_loop_executes_tool_then_returns_final_text(monkeypatch):
    # provider = openrouter, and capture the tool's side-effect write
    monkeypatch.setattr(config, "MODEL_PROVIDER", "openrouter")
    monkeypatch.setattr(config, "AGENT_MODEL", "google/gemini-2.5-flash")
    writes = []
    monkeypatch.setattr(bus, "write_action", lambda sb, **kw: writes.append(kw))

    # fake client: 1st turn → call place_ad; 2nd turn → final text, no tool_calls
    responses = iter([
        _msg("", [_tool_call("c1", "place_ad", '{"style_id":"s-1","slot":"top_funnel","budget_cents":5000}')]),
        _msg("Placed the ad."),
    ])
    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(
        create=lambda **kw: next(responses))))
    monkeypatch.setattr(runner, "_openai", lambda: fake)

    ctx = tools.RunContext(sb=object(), run_id="run-x", merchant_id="m-x")
    final = runner.run_agent(system="sys", tool_names=["place_ad"], task="go", ctx=ctx)

    assert final == "Placed the ad."
    # the real place_ad body ran → one captured action write
    assert len(writes) == 1 and writes[0]["action_type"] == "place_ad"
    assert writes[0]["payload"] == {"styleId": "s-1", "slot": "top_funnel", "budgetCents": 5000}
    # transcript order: tool's tool_call + action (from the body), then the final reasoning text
    assert [s["kind"] for s in ctx.transcript] == ["tool_call", "action", "reasoning"]
    # the attempt recorder logged the successful call (name + parsed args + ok), for the eval gate
    assert ctx.tool_attempts == [{"tool": "place_ad",
                                  "args": {"style_id": "s-1", "slot": "top_funnel", "budget_cents": 5000},
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
