-- 0023_style_concept.sql  (选品 trend↔catalog matching — VLM concepts + pgvector)
-- Derived, cached per-style artifact: a VLM reads each nail photo and emits a structured CN concept
-- (visual attributes + inferred vibe/occasion). The concept_text is embedded (Cohere embed-multilingual
-- -v3.0, 1024-d) so a trend keyword can be matched by hybrid retrieve (pgvector cosine) → rerank.
-- Persisted (not compute-on-read) because VLM+embed is costly; re-enrich when source_media_asset_id
-- changes. Scoped by merchant_id; service-role writes only (ADR-0006/0007). MANUAL apply (no CLI), as 0022.

create extension if not exists vector;

create table if not exists public.style_concept (
  style_id              text primary key references public.merchant_style(id) on delete cascade,
  merchant_id           text not null,
  source_media_asset_id text,                    -- re-enrich when the primary image changes
  concept_json          jsonb not null default '{}',   -- structured attributes (auditable; better tags)
  concept_text          text  not null default '',      -- CN sentence = the embed / rerank document
  embedding             vector(1024),                    -- Cohere embed-multilingual-v3.0
  model                 text not null default '',        -- vlm+embed model ids (staleness key)
  pipeline_version      text not null default '',        -- prompt/schema/flatten version (staleness key)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- idempotent: adds the staleness column if an earlier 0023 (without it) was already applied.
alter table public.style_concept add column if not exists pipeline_version text not null default '';

create index if not exists style_concept_merchant_idx on public.style_concept (merchant_id);
-- ANN index for cosine search (optional at demo scale, correct for growth).
create index if not exists style_concept_embedding_idx
  on public.style_concept using hnsw (embedding vector_cosine_ops);

alter table public.style_concept enable row level security;
-- No anon policies: service-role only (the Python enrichment + matcher).
