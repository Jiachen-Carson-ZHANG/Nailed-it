"""Runs one agent as a tool-call loop. ONE public entry — `run_agent` — with two interchangeable
backends behind the MODEL_PROVIDER flag (see config):

  - anthropic  → Claude via the SDK's `tool_runner` (beta): reasons, calls a tool, loops. Prod path.
  - openrouter → Gemini/GPT/etc via the OpenAI SDK pointed at OpenRouter: a manual call→tool→call
                 loop in OpenAI function-call format. Cheap dev path.

Both drive the SAME tool bodies (tools.IMPL) and write into the SAME RunContext.transcript, so the
orchestrator, skills, tools, and panel are provider-agnostic — only the model adapter differs."""
from __future__ import annotations

import json

from . import config, tools

_anthropic_client = None
_openai_client = None
_MAX_TOOL_ITERS = 8  # safety cap on the dev loop (Anthropic's tool_runner caps itself)


def _anthropic():
    global _anthropic_client
    if _anthropic_client is None:
        from anthropic import Anthropic
        _anthropic_client = Anthropic(api_key=config.ANTHROPIC_API_KEY)
    return _anthropic_client


def _openai():
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI  # lazy — only needed for the OpenRouter path
        _openai_client = OpenAI(api_key=config.OPENROUTER_API_KEY, base_url=config.OPENROUTER_BASE_URL)
    return _openai_client


def run_agent(*, system: str, tool_names: list[str], task: str, ctx: tools.RunContext, max_tokens: int = 2048, max_iters: int = _MAX_TOOL_ITERS, model: str | None = None) -> str:
    """Run one agent with its skill (system), tool allow-list (by name), and task. Returns final text.
    The tool bodies append their own tool_call/action transcript steps; here we append reasoning."""
    token = tools.use_context(ctx)
    try:
        if config.MODEL_PROVIDER == "openrouter":
            return _run_openrouter(system, tool_names, task, ctx, max_tokens, max_iters, model)
        return _run_anthropic(system, tool_names, task, ctx, max_tokens, model)
    finally:
        tools.reset_context(token)


def _run_anthropic(system: str, tool_names: list[str], task: str, ctx: tools.RunContext, max_tokens: int, model: str | None = None) -> str:
    runner = _anthropic().beta.messages.tool_runner(
        model=model or config.AGENT_MODEL,
        max_tokens=max_tokens,
        system=system,
        tools=[tools.BETA_TOOLS[n] for n in tool_names],
        messages=[{"role": "user", "content": task}],
    )
    final_text = ""
    # Iterating the runner drives the loop; tools run (and append their own steps) between yields, so
    # appending reasoning at yield time keeps the transcript in execution order.
    for message in runner:
        for block in message.content:
            if block.type == "text" and block.text.strip():
                ctx.transcript.append({"kind": "reasoning", "text": block.text})
                final_text = block.text
    return final_text


def _run_openrouter(system: str, tool_names: list[str], task: str, ctx: tools.RunContext, max_tokens: int, max_iters: int = _MAX_TOOL_ITERS, model: str | None = None) -> str:
    client = _openai()
    schemas = [tools.OPENAI_TOOLS[n] for n in tool_names]
    allowed = {n: tools.IMPL[n] for n in tool_names}  # ONLY these execute — a model may hallucinate an
    # off-allow-list tool name; we must NOT run it (its side effect would fire before any eval flags it).
    messages: list[dict] = [
        {"role": "system", "content": system},
        {"role": "user", "content": task},
    ]
    final_text = ""
    for _ in range(max_iters):
        resp = client.chat.completions.create(
            model=model or config.AGENT_MODEL, max_tokens=max_tokens, messages=messages, tools=schemas,
        )
        msg = resp.choices[0].message
        if msg.content and msg.content.strip():
            ctx.transcript.append({"kind": "reasoning", "text": msg.content})
            final_text = msg.content
        if not msg.tool_calls:
            break
        messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in msg.tool_calls
            ],
        })
        for tc in msg.tool_calls:
            name = tc.function.name
            impl = allowed.get(name)  # allow-list only — off-list names resolve to None → never executed
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {"_raw": tc.function.arguments}
            # record the ATTEMPT (name + args) before executing, so invalid calls are visible even when
            # the tool body raises before appending its own transcript step (tool-call-correctness gate).
            if impl is None:
                result, status, err = f"error: tool '{name}' not in allow-list", "error", "off_allowlist"
            else:
                try:
                    result, status, err = impl(**args), "ok", None
                except Exception as e:  # surface tool errors back to the model instead of crashing the loop
                    result, status, err = f"error: {e}", "error", str(e)
            ctx.tool_attempts.append({"tool": name, "args": args, "status": status, "error": err})
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})
    return final_text
