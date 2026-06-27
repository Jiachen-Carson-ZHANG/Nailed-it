"""Env config. Reuses the repo-root .env.local (Supabase keys live there).

Two model providers, selected by MODEL_PROVIDER (one flag — same orchestrator, skills, tools either way):
  - "anthropic"  (default, prod): Claude via the Anthropic SDK `tool_runner`. Needs ANTHROPIC_API_KEY.
  - "openrouter" (cheap dev):     Gemini/GPT/etc via the OpenAI SDK pointed at OpenRouter. Needs
                                   OPENROUTER_API_KEY. One key covers many models.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# repo-root: agent-service/nailed_agents/config.py → parents[2]
_ROOT = Path(__file__).resolve().parents[2]
for _name in (".env.local", ".env"):
    _p = _ROOT / _name
    if _p.exists():
        load_dotenv(_p)

MODEL_PROVIDER = os.environ.get("MODEL_PROVIDER", "anthropic").strip().lower()

# Anthropic (prod path)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# OpenRouter (cheap dev path) — OpenAI-compatible endpoint; one key → Gemini/GPT/Claude/etc.
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

# Supabase (shared bus)
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

APP_URL = os.environ.get("NAILED_APP_URL", "http://localhost:3000")
MERCHANT_ID = os.environ.get("NAILED_MERCHANT_ID", "merchant-nailed-it")

# Model id. Provider-specific default (cheap for dev); override with AGENT_MODEL.
#   anthropic  → claude-haiku-4-5 (cheap; set claude-opus-4-8 / claude-sonnet-4-6 for the demo)
#   openrouter → google/gemini-2.0-flash-001 (cheap, supports tool-calling; or openai/gpt-4o-mini)
_DEFAULT_MODEL = {
    "anthropic": "claude-haiku-4-5",
    "openrouter": "google/gemini-2.5-flash",
}
AGENT_MODEL = os.environ.get("AGENT_MODEL") or _DEFAULT_MODEL.get(MODEL_PROVIDER, "claude-haiku-4-5")


def require_env() -> None:
    """Validate the env for the selected provider (Supabase always; the chosen model key)."""
    checks: list[tuple[str, str]] = [
        ("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL),
        ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY),
    ]
    if MODEL_PROVIDER == "anthropic":
        checks.append(("ANTHROPIC_API_KEY", ANTHROPIC_API_KEY))
    elif MODEL_PROVIDER == "openrouter":
        checks.append(("OPENROUTER_API_KEY", OPENROUTER_API_KEY))
    else:
        raise SystemExit(f"Unknown MODEL_PROVIDER '{MODEL_PROVIDER}' — use 'anthropic' or 'openrouter'.")

    missing = [name for name, val in checks if not val]
    if missing:
        raise SystemExit(
            "Missing env: " + ", ".join(missing) + " — set them in the repo-root .env.local "
            f"(MODEL_PROVIDER={MODEL_PROVIDER})"
        )
