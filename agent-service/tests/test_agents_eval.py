"""Phase C tests for the agent-eval harness — quality_judge parsing/error-handling + _log_regression
persistence. Network-free: a fake OpenAI client returns canned judge outputs; the regression file is a
tmp path. Loads eval/agents_eval.py by path (eval/ is a scripts dir, not a package)."""
import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import openai

_AE_PATH = Path(__file__).resolve().parents[1] / "eval" / "agents_eval.py"
_spec = importlib.util.spec_from_file_location("agents_eval", _AE_PATH)
agents_eval = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = agents_eval  # required so @dataclass can resolve the module (sys.modules lookup)
_spec.loader.exec_module(agents_eval)


def _fake_openai(by_model: dict[str, str]):
    """Fake openai.OpenAI whose chat.completions.create returns canned content keyed by the model arg."""
    def create(model, **kw):
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=by_model.get(model, "")))])
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    return lambda **kw: client


_SCN = agents_eval.Scenario(id="t/x", slug="catalog", tools=[], task="do x",
                            briefing={"k": 1}, customers=[], expect={"kind": "action", "action_type": "delist_style", "target": "s-1"})


def test_quality_judge_parses_valid_and_isolates_errors(monkeypatch):
    # gemini → valid JSON (score 4); gpt-4o → malformed (not JSON) → error, NOT averaged as 0
    monkeypatch.setattr(openai, "OpenAI", _fake_openai({
        "google/gemini-2.5-flash": '{"准确性":4,"完整性":4,"实用性":4,"安全性":5,"overall":4,"why":"ok"}',
        "openai/gpt-4o": "sorry, I need more context",
    }))
    jr = agents_eval.quality_judge(_SCN, "some agent output")
    assert jr["valid"] == [4.0]                       # only the valid judge's score
    assert jr["avg"] == 4.0                            # error judge did NOT drag it to a fabricated 0
    assert jr["errored"] == ["openai/gpt-4o"]
    assert jr["flagged"] is True                       # a judge error flags human-review
    per = {x["model"]: x for x in jr["results"]}
    assert per["openai/gpt-4o"]["score"] is None and per["openai/gpt-4o"]["error"]


def test_quality_judge_rejects_out_of_range_overall(monkeypatch):
    monkeypatch.setattr(openai, "OpenAI", _fake_openai({
        "google/gemini-2.5-flash": '{"overall":9}',   # out of 1..5 → error, not a score
        "openai/gpt-4o": '{"overall":0}',              # out of range → error
    }))
    jr = agents_eval.quality_judge(_SCN, "out")
    assert jr["valid"] == [] and jr["avg"] is None
    assert set(jr["errored"]) == {"google/gemini-2.5-flash", "openai/gpt-4o"}
    assert jr["flagged"] is True


def test_log_regression_writes_rich_replayable_record(monkeypatch, tmp_path):
    regr = tmp_path / "regr.jsonl"
    monkeypatch.setattr(agents_eval, "_REGR", regr)
    rep = {"sig": ("delist_style", "{}"), "final": "下架 s-9", "tool_bad": "delist_style: ungrounded",
           "forbid_hit": [], "ungrounded": ["s-9"],
           "captured": [{"action_type": "delist_style", "payload": {"styleId": "s-9"}}],
           "tool_attempts": [{"tool": "delist_style", "args": {"style_id": "s-9"}, "status": "ok", "error": None}]}
    r = {"rep": rep, "rep_index": 2, "run_signatures": ["()", "()", "('delist_style','{}')"]}
    jr = {"results": [{"model": "m", "score": 2.0, "error": None, "raw": "..."}], "valid": [2.0],
          "avg": 2.0, "spread": 0.0, "errored": [], "flagged": True, "reason": ["low avg 2.0"]}

    agents_eval._log_regression(_SCN, ["tool-call correctness"], r, jr)

    rec = json.loads(regr.read_text(encoding="utf-8").strip())
    assert rec["scenario"] == "t/x" and rec["category"] == "tool_call"   # gate_fail → tool_call category
    assert rec["rep_index"] == 2 and len(rec["run_signatures"]) == 3     # captured the FAILING run, not run 0
    assert rec["task"] == "do x" and rec["fixture"]["briefing"] == {"k": 1}
    assert rec["captured_actions"] and rec["tool_attempts"] and rec["judge"]["errored"] == []
    assert rec["final"] == "下架 s-9"
