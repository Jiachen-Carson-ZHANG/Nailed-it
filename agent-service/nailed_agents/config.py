"""Env config. Reuses the repo-root .env.local (Supabase keys live there).

Three model providers, selected by MODEL_PROVIDER (one flag — same orchestrator, skills, tools either way):
  - "openrouter" (default demo): Gemini/GPT/etc via the OpenAI SDK pointed at OpenRouter. Needs
                                  OPENROUTER_API_KEY. One key covers many models.
  - "gemini"     (fallback):     the SAME Gemini models via Google's OpenAI-compatible endpoint —
                                  drop-in when OpenRouter credits run dry. Needs GEMINI_API_KEY
                                  (already present for embeddings). Same loop, same recorder.
  - "anthropic"  (optional):     Claude via the Anthropic SDK `tool_runner`. Needs ANTHROPIC_API_KEY.
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

MODEL_PROVIDER = os.environ.get("MODEL_PROVIDER", "openrouter").strip().lower()

# Anthropic (prod path)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# OpenRouter (default demo path) — OpenAI-compatible endpoint; one key → Gemini/GPT/Claude/etc.
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

# Gemini direct (fallback path) — Google's OpenAI-compatible endpoint; model ids WITHOUT the
# "google/" prefix (gemini-2.5-flash, gemini-2.5-pro). GEMINI_API_KEY is defined below (embeddings).
GEMINI_BASE_URL = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")

# Supabase (shared bus)
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

APP_URL = os.environ.get("NAILED_APP_URL", "http://localhost:3000")
MERCHANT_ID = os.environ.get("NAILED_MERCHANT_ID", "merchant-nailed-it")

# 选品 external-trend source (one flag — same agent either way):
#   "fixture"   (default): authored CN-flavored trends (deterministic, no key) — see trends fixture.
#   "pinterest" (live):    Pinterest Trends API. Needs PINTEREST_APP_ID + PINTEREST_APP_SECRET + a
#                          user-authorized refresh token. NOTE: regions are Western only (US, GB+IE,
#                          CA, AU+NZ, DE, FR, …) — NO China/Asia. Scoped to interest=beauty (nail-domain).
TREND_SOURCE = os.environ.get("TREND_SOURCE", "fixture").strip().lower()
PINTEREST_APP_ID = os.environ.get("PINTEREST_APP_ID", "")
PINTEREST_APP_SECRET = os.environ.get("PINTEREST_APP_SECRET", "")
PINTEREST_REGION = os.environ.get("PINTEREST_REGION", "US")
# Scope live trends to a Pinterest interest category — without it, top/growing returns generic
# pop-culture noise (TV shows, holidays). "beauty" is the closest to nails (no dedicated nail interest);
# ~21/25 beauty trends are nail-domain. Valid: animals, architecture, art, beauty, childrens_fashion,
# design, diy_and_crafts, education, electronics, entertainment, event_planning, finance,
# food_and_drinks, gardening, health, home_decor, mens_fashion, parenting, quotes, sport, travel,
# vehicles, wedding, womens_fashion.
PINTEREST_INTERESTS = os.environ.get("PINTEREST_INTERESTS", "beauty")
# Default trend window when the agent doesn't pick one. The 选品 agent can override per call via the
# tool's trend_type arg. Valid: growing (fastest risers now), monthly, seasonal (current-season spikes),
# yearly. Seasonal suits salons (holiday/wedding spikes).
PINTEREST_TREND_TYPE = os.environ.get("PINTEREST_TREND_TYPE", "growing")
PINTEREST_BASE_URL = os.environ.get("PINTEREST_BASE_URL", "https://api.pinterest.com/v5")
# Trends needs a USER-authorized token (ads:read on an ad account) — app-only client_credentials gets
# a token but 401s on /trends. Get a refresh token once via `npm run pinterest:auth`; we mint a fresh
# access token from it each run (continuous refresh, ~60-day). Falls back to client_credentials.
PINTEREST_REFRESH_TOKEN = os.environ.get("PINTEREST_REFRESH_TOKEN", "")
PINTEREST_ACCESS_TOKEN = os.environ.get("PINTEREST_ACCESS_TOKEN", "")
PINTEREST_REDIRECT_URI = os.environ.get("PINTEREST_REDIRECT_URI", "https://localhost/")

# Model id. Provider-specific default; override with AGENT_MODEL.
#   openrouter → google/gemini-2.5-flash (cheap, supports tool-calling; or openai/gpt-4o-mini)
#   anthropic  → claude-haiku-4-5 (cheap; set claude-opus-4-8 / claude-sonnet-4-6 if using Anthropic)
_DEFAULT_MODEL = {
    "anthropic": "claude-haiku-4-5",
    "openrouter": "google/gemini-2.5-flash",
    "gemini": "gemini-2.5-flash",
}
AGENT_MODEL = os.environ.get("AGENT_MODEL") or _DEFAULT_MODEL.get(MODEL_PROVIDER, "google/gemini-2.5-flash")

# ADR-0013 P1: the orchestrator drives a LONG multi-step dispatch chain — flash-tier models reliably
# abandon it after one tool call. The round's brain runs a stronger model; lanes stay on AGENT_MODEL.
_DEFAULT_ORCH_MODEL = {"anthropic": "claude-sonnet-4-6", "openrouter": "google/gemini-2.5-pro",
                       "gemini": "gemini-2.5-pro"}
ORCHESTRATOR_MODEL = os.environ.get("ORCHESTRATOR_MODEL") or _DEFAULT_ORCH_MODEL.get(MODEL_PROVIDER, AGENT_MODEL)

# ADR-0015: the monitor is the second long-chain agent (N outcome writes + verdict + bounded revision).
# Measured live 2026-07-11: on flash it made ONE tool call then NARRATED unperformed memory writes and
# revisions — the exact orchestrator failure class, so it gets the same fix. One run per round.
MONITOR_MODEL = os.environ.get("MONITOR_MODEL") or ORCHESTRATOR_MODEL

# ADR-0016: decision (facts → Action Briefs) and ad (forecast loops) become long-chain agents too —
# same measured failure class, same fix. Bounded cost: ≤4 strong-tier runs per round.
DECISION_MODEL = os.environ.get("DECISION_MODEL") or ORCHESTRATOR_MODEL
AD_MODEL = os.environ.get("AD_MODEL") or ORCHESTRATOR_MODEL
# ADR-0016 Stage 2: soft-risk review is nuanced judgment over structured briefs — strong tier.
REVIEWER_MODEL = os.environ.get("REVIEWER_MODEL") or ORCHESTRATOR_MODEL
# Stage 3: coupon now judges templates + restrictions — measured flash narration flake → strong tier.
COUPON_MODEL = os.environ.get("COUPON_MODEL") or ORCHESTRATOR_MODEL

# 选品 trend↔catalog matching (design: docs/eval/2026-07-01-trend-matching-design.md).
#   "tag"     (default): tag-overlap in trend_logic — cheap, no keys, brittle (broad-tag false positives).
#   "concept" (opt-in):  VLM concept per style (cached in style_concept) → Cohere embed → pgvector top-k
#                        → Cohere rerank → threshold. Accurate + cross-lingual. Needs COHERE_API_KEY.
MATCH_MODE = os.environ.get("MATCH_MODE", "tag").strip().lower()
# Enrichment VLM runs on OpenRouter (multimodal) regardless of MODEL_PROVIDER.
ENRICH_VLM_MODEL = os.environ.get("ENRICH_VLM_MODEL", "google/gemini-2.5-flash")

# Embedding provider — chosen by eval 2026-07-01 (see docs/eval/2026-07-01-trend-matching-design.md):
# google/gemini-embedding-001 won cross-lingual recall+ranking decisively (R@10 0.91 vs Cohere 0.78 /
# OpenAI-3-large 0.72). google|cohere|openrouter. Rerank stays Cohere (won on latency/determinism at
# tied quality). EMBED_DIM 1024 fits the style_concept.embedding column across providers.
EMBED_PROVIDER = os.environ.get("EMBED_PROVIDER", "google").strip().lower()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
EMBED_DIM = 1024
_DEFAULT_EMBED_MODEL = {
    "google": "gemini-embedding-001",
    "cohere": "embed-multilingual-v3.0",
    "openrouter": "openai/text-embedding-3-large",
}
EMBED_MODEL = os.environ.get("EMBED_MODEL") or _DEFAULT_EMBED_MODEL.get(EMBED_PROVIDER, "gemini-embedding-001")

# Cohere rerank (the reranker; also the embedder when EMBED_PROVIDER=cohere).
COHERE_API_KEY = os.environ.get("COHERE_API_KEY", "")
COHERE_BASE_URL = os.environ.get("COHERE_BASE_URL", "https://api.cohere.com/v2")
COHERE_EMBED_MODEL = os.environ.get("COHERE_EMBED_MODEL", "embed-multilingual-v3.0")  # used iff EMBED_PROVIDER=cohere
COHERE_RERANK_MODEL = os.environ.get("COHERE_RERANK_MODEL", "rerank-multilingual-v3.5")
MATCH_TOP_K = int(os.environ.get("MATCH_TOP_K", "15"))          # pgvector recall before rerank
MATCH_THRESHOLD = float(os.environ.get("MATCH_THRESHOLD", "0.3"))  # min rerank score to count as a match

# key needed for the selected embed provider (rerank always needs Cohere in concept mode)
_EMBED_PROVIDER_KEY = {"google": ("GEMINI_API_KEY", GEMINI_API_KEY),
                       "cohere": ("COHERE_API_KEY", COHERE_API_KEY),
                       "openrouter": ("OPENROUTER_API_KEY", OPENROUTER_API_KEY)}


# ADR-0013 P0: pending 上架建议 cap. New-listing ideas originate from weekly-cadence sources (internal
# hot + external trends) — the pending queue must never outrun that cadence. Merchant policy later.
MAX_PENDING_PROPOSALS = int(os.environ.get("MAX_PENDING_PROPOSALS", "5"))

# ADR-0016: the merchant's weekly marketing budget envelope (SGD 180) — get_ad_account_state
# reports remaining vs committed; a merchant-policy surface later makes this editable.
MARKETING_BUDGET_CENTS = int(os.environ.get("MARKETING_BUDGET_CENTS", "18000"))

# ADR-0013 P1: per-round orchestration guardrails (the LLM chooses; code bounds).
MAX_DISPATCHES_PER_ROUND = int(os.environ.get("MAX_DISPATCHES_PER_ROUND", "9"))  # 9 lanes since the reviewer (ADR-0016 S2)

# Sampling temperature for the OpenAI-compatible loop. Operations agents judge against bright-line
# thresholds — low temperature is a feature (reproducible rounds, stable eval), not a limitation.
# Default 1.0 measurably flip-flopped the monitor on identical inputs (gemini direct, 2026-07-11).
AGENT_TEMPERATURE = float(os.environ.get("AGENT_TEMPERATURE", "0.2"))

# Gemini-direct only: 2.5 models think by default and the thoughts consume max_tokens — measured as
# one-tool-call-then-empty-response chain abandonment. "low" bounds the thinking budget so content
# survives; valid for both flash (lanes) and pro (orchestrator, which can't disable thinking).
GEMINI_REASONING_EFFORT = os.environ.get("GEMINI_REASONING_EFFORT", "low")


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
    elif MODEL_PROVIDER == "gemini":
        checks.append(("GEMINI_API_KEY", GEMINI_API_KEY))
    else:
        raise SystemExit(f"Unknown MODEL_PROVIDER '{MODEL_PROVIDER}' — use 'anthropic', 'openrouter' or 'gemini'.")

    if TREND_SOURCE == "pinterest":
        checks += [("PINTEREST_APP_ID", PINTEREST_APP_ID), ("PINTEREST_APP_SECRET", PINTEREST_APP_SECRET)]
    if MATCH_MODE == "concept":
        checks.append(("COHERE_API_KEY", COHERE_API_KEY))  # rerank
        checks.append(_EMBED_PROVIDER_KEY.get(EMBED_PROVIDER, ("EMBED_PROVIDER", "")))  # embed

    missing = [name for name, val in checks if not val]
    if missing:
        raise SystemExit(
            "Missing env: " + ", ".join(missing) + " — set them in the repo-root .env.local "
            f"(MODEL_PROVIDER={MODEL_PROVIDER})"
        )
