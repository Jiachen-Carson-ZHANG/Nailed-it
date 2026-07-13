-- 0031: prompt identity snapshot on runs (ADR-0014).
-- skills/*.md is the prompt source of truth — editing a skill changes agent behavior while
-- agents.version stays untouched. Runs therefore pin the RESOLVED prompt identity: the sha of the
-- system text that actually ran, plus the agent config version at run time. Enables prompt A/B:
-- edit a skill, runs carry a new sha, group eval/live outcomes by sha.
alter table public.agent_runs
  add column if not exists prompt_sha text,
  add column if not exists agent_version int;

comment on column public.agent_runs.prompt_sha is
  'full sha256 (64 hex) of the resolved system prompt (skill file or instructions fallback) that produced this run';
comment on column public.agent_runs.agent_version is
  'agents.version at run time — config version, NOT the prompt version (that is prompt_sha)';
