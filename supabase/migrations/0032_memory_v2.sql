-- 0032 — memory v2 (ADR-0015): from one-sentence verdicts to scoped, evidence-anchored experience.
--
-- Principle: the AGENT decides what was learned (claim + confidence); CODE decides identity and
-- evidence (which action/entity it is about, the prediction it is compared against, the observation
-- window, when it expires). Raw metrics still live in style_ad_campaign / event tables — memory rows
-- carry a prediction-vs-measured COMPARISON snapshot, never a shadow copy of live data.
--
-- Kinds (replaces ad_outcome/coupon_outcome):
--   action_outcome      — measured result of ONE action (anchored to agent_actions.id)
--   calibration         — systematic prediction bias ("expectedRoas 高估 ~2x for metallic styles")
--   round_verdict       — round-level operational conclusion (unchanged)
--   merchant_preference — explicit merchant-stated constraints (written via UI events, never inferred
--                         by an agent from one behavior; long/no expiry)
--
-- Apply AFTER 0030.

alter table public.agent_memory
  drop constraint if exists agent_memory_kind_check;
alter table public.agent_memory
  add constraint agent_memory_kind_check
  check (kind in ('action_outcome', 'calibration', 'round_verdict', 'merchant_preference',
                  -- legacy kinds kept readable until any pre-v2 rows expire (30d TTL)
                  'ad_outcome', 'coupon_outcome'));

alter table public.agent_memory
  add column if not exists domain text
    check (domain in ('ad', 'coupon', 'catalog', 'customer_ops', 'round', 'merchant')),
  add column if not exists scope_type text
    check (scope_type in ('style', 'entity', 'merchant', 'segment', 'tag')),
  add column if not exists scope_id text,
  add column if not exists scope_tags text[] not null default '{}',
  add column if not exists claim text,
  add column if not exists comparison jsonb,        -- {metric, predicted, measured, ratio, direction}
  add column if not exists applicability jsonb,     -- {styleTags, funnelSlot, capacityBand, ...}
  add column if not exists confidence text
    check (confidence in ('low', 'medium', 'high')),
  add column if not exists source_action_id uuid references public.agent_actions(id) on delete set null;

comment on column public.agent_memory.claim is
  'the agent''s conclusion in one or two sentences — semantic judgment is the model''s job';
comment on column public.agent_memory.comparison is
  'code-derived prediction-vs-measured snapshot at write time — referential integrity is code''s job';
comment on column public.agent_memory.source_action_id is
  'the agent_actions row this outcome measures; action_outcome rows are keyed by it (kind+key)';

create index if not exists agent_memory_scope_idx
  on public.agent_memory (merchant_id, scope_type, scope_id);
