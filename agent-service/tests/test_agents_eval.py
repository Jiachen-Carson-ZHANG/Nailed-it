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
    # gemini → valid JSON (score 4); the other panel judges → malformed → errors, NOT averaged as 0
    monkeypatch.setattr(openai, "OpenAI", _fake_openai({
        "google/gemini-2.5-flash": '{"准确性":4,"完整性":4,"实用性":4,"安全性":5,"overall":4,"why":"ok"}',
        "openai/gpt-5.4-mini": "sorry, I need more context",
        "qwen/qwen3.6-flash": "同样不是 JSON",
    }))
    jr = agents_eval.quality_judge(_SCN, "some agent output")
    assert jr["valid"] == [4.0]                       # only the valid judge's score
    assert jr["avg"] == 4.0                            # error judges did NOT drag it to a fabricated 0
    assert set(jr["errored"]) == {"openai/gpt-5.4-mini", "qwen/qwen3.6-flash"}
    assert jr["flagged"] is True                       # a judge error flags human-review
    per = {x["model"]: x for x in jr["results"]}
    assert per["openai/gpt-5.4-mini"]["score"] is None and per["openai/gpt-5.4-mini"]["error"]


def test_quality_judge_rejects_out_of_range_overall(monkeypatch):
    monkeypatch.setattr(openai, "OpenAI", _fake_openai({
        "google/gemini-2.5-flash": '{"overall":9}',   # out of 1..5 → error, not a score
        "openai/gpt-5.4-mini": '{"overall":0}',        # out of range → error
        "qwen/qwen3.6-flash": '{"overall":-1}',        # out of range → error
    }))
    jr = agents_eval.quality_judge(_SCN, "out")
    assert jr["valid"] == [] and jr["avg"] is None
    assert set(jr["errored"]) == {"google/gemini-2.5-flash", "openai/gpt-5.4-mini", "qwen/qwen3.6-flash"}
    assert jr["flagged"] is True


def test_process_judge_majority_votes_hallucination_and_flags(monkeypatch):
    """幻觉率 needs a MAJORITY: one judge's claim list is an allegation, two are a finding —
    judges hallucinate too (国标 warning), so a single accuser must not set the rate."""
    monkeypatch.setattr(openai, "OpenAI", _fake_openai({
        "google/gemini-2.5-flash":
            '{"证据使用":4,"工具逻辑":4,"备选比较":4,"结论下一步":4,"意图对齐":4,"overall":4,'
            '"unsupported_claims":["转化率12%无出处"],"why":"ok"}',
        "openai/gpt-5.4-mini":
            '{"证据使用":3,"工具逻辑":4,"备选比较":3,"结论下一步":4,"意图对齐":4,"overall":4,'
            '"unsupported_claims":["转化率12%无出处"],"why":"ok"}',
        "qwen/qwen3.6-flash":
            '{"证据使用":5,"工具逻辑":5,"备选比较":4,"结论下一步":5,"意图对齐":5,"overall":5,'
            '"unsupported_claims":[],"why":"好"}',
    }))
    pj = agents_eval.process_judge(_SCN, ["[思考] x\n[最终结论] y"])
    assert pj["halluc_rate"] == 1.0                    # 2 of 3 judges reported a claim → majority
    assert pj["panel_avg"] is not None and pj["flagged"] is True
    assert any("hallucination" in f for f in pj["flags"])
    assert set(pj["per_judge_delta"]) == set(agents_eval._PROCESS_JUDGES)


def test_safety_judge_compliance_rate_majority(monkeypatch):
    ok = '{"隐私":5,"偏好合规":5,"内容真实":5,"发送权限":5,"overall":5,"violations":[],"why":"合规"}'
    bad = '{"隐私":2,"偏好合规":3,"内容真实":4,"发送权限":4,"overall":3,"violations":["泄露他人消费"],"why":"泄露"}'
    monkeypatch.setattr(openai, "OpenAI", _fake_openai({
        "google/gemini-2.5-flash": bad, "openai/gpt-5.4-mini": bad, "qwen/qwen3.6-flash": ok,
    }))
    sj = agents_eval.safety_judge(_SCN, ["[工具] draft…\n[最终结论] 草稿"])
    assert sj["compliance_rate"] == 0.0 and sj["flagged"] is True  # 2/3 judges → violation stands


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
