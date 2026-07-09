-- ADR-0012 follow-up (audit #3). Migration 0027 adds style_ad_campaign.source_run_id behind an
-- `if table exists` guard, because the ad-campaign tables (0022_style_ad_campaign, 0023–0025) are not
-- applied on every database. A migration runner will not naturally re-run 0027 later, so a DB that applied
-- the ad tables AFTER 0027 would silently miss the column.
--
-- This migration adds it unconditionally and idempotently. Run it after the ad-campaign tables exist.
-- Safe to run more than once; a no-op when 0027 already added the column.

alter table public.style_ad_campaign
  add column if not exists source_run_id uuid references public.agent_runs(id) on delete set null;

comment on column public.style_ad_campaign.source_run_id is
  'The agent run that proposed this campaign (ADR-0012). NULL = merchant-authored, not agent-proposed.';
