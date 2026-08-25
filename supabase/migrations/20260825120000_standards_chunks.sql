-- Corpus of humanitarian standards, chunked for hybrid retrieval.
--
-- One row per chunk of a source document (Sphere Handbook, CHS, IASC guidance).
-- Each chunk carries both a Voyage AI embedding (semantic recall) and a tsvector
-- (lexical recall for the numbers and defined terms these standards turn on --
-- "15 litres", "Protection Principle 2" -- where embeddings alone are weak).
-- search_standards_hybrid() fuses the two rankings.

-- pgvector lives in `extensions`, not `public`, so the Data API never exposes
-- it. `if not exists` alone would silently leave a pre-existing extension in
-- whatever schema it was installed into, which would break the qualified
-- `extensions.vector` references below, so relocate it when that happens.
create schema if not exists extensions;

do $$
declare
  ext_schema name;
begin
  select n.nspname into ext_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'vector';

  if ext_schema is null then
    create extension vector with schema extensions;
  elsif ext_schema <> 'extensions' then
    alter extension vector set schema extensions;
  end if;
end
$$;

create table public.standards_chunks (
  -- Deterministic UUIDv5 derived by the ingestion pipeline from
  -- (source, section_path, page range, content), so re-ingesting an unchanged
  -- document upserts onto the same rows instead of duplicating the corpus.
  id uuid primary key,
  source text not null,
  doc_title text not null,
  section_path text not null default '',
  page_start integer,
  page_end integer,
  content text not null,
  -- One or two sentences from claude-haiku-4-5 situating the chunk in its
  -- document (Anthropic's contextual retrieval). Empty when the pipeline ran
  -- without ANTHROPIC_API_KEY.
  context_summary text not null default '',
  -- voyage-3.5, 1024 dimensions. Nullable so extract/chunk/load can run before
  -- embeddings exist.
  embedding extensions.vector(1024),
  fts tsvector generated always as (
    to_tsvector('english', content || ' ' || context_summary)
  ) stored,
  created_at timestamptz not null default now(),

  constraint standards_chunks_source_check check (
    source in (
      'sphere',
      'chs',
      'iasc_data_responsibility',
      'iasc_protection',
      'iasc_disability'
    )
  ),
  constraint standards_chunks_content_not_blank check (length(btrim(content)) > 0),
  constraint standards_chunks_pages_ordered check (
    page_start is null or page_end is null or page_end >= page_start
  )
);

comment on table public.standards_chunks is
  'Chunks of humanitarian standards documents with Voyage embeddings and full-text vectors for hybrid retrieval. Source PDFs are not redistributable; see ingestion/corpus/SOURCES.md.';
comment on column public.standards_chunks.section_path is
  'Heading breadcrumb, e.g. "WASH > Water supply > Standard 2.1". Used for citation display, not for filtering.';
comment on column public.standards_chunks.context_summary is
  'Contextual-retrieval preamble; empty string when contextualization was skipped.';

-- Approximate nearest neighbour over cosine distance. HNSW builds slower than
-- IVFFlat but needs no training pass and stays accurate as the corpus grows,
-- which matters here because sources are ingested one document at a time.
create index standards_chunks_embedding_idx
  on public.standards_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create index standards_chunks_fts_idx
  on public.standards_chunks
  using gin (fts);

-- search_standards_hybrid() filters by source inside both legs of the fusion.
create index standards_chunks_source_idx
  on public.standards_chunks (source);

alter table public.standards_chunks enable row level security;

-- The corpus is public reference material: everyone reads, nobody writes
-- through the Data API. Ingestion connects with the service role, which bypasses
-- RLS entirely.
revoke all on public.standards_chunks from anon, authenticated;
grant select on public.standards_chunks to anon, authenticated;

create policy standards_chunks_public_read
  on public.standards_chunks
  for select
  to anon, authenticated
  using (true);

-- Reciprocal rank fusion over a vector-similarity ranking and a full-text
-- ranking. RRF is used rather than a weighted sum of raw scores because cosine
-- distance and ts_rank_cd are not on comparable scales, so any weighting would
-- have to be retuned whenever the embedding model changes.
--
-- security invoker (the default) so the caller's RLS applies; search_path is
-- pinned empty and every non-pg_catalog name is schema-qualified.
create or replace function public.search_standards_hybrid(
  query_text text,
  query_embedding extensions.vector(1024),
  match_count integer default 8,
  filter_source text default null
)
returns table (
  id uuid,
  source text,
  doc_title text,
  section_path text,
  page_start integer,
  page_end integer,
  content text,
  context_summary text,
  score double precision,
  semantic_rank integer,
  fulltext_rank integer
)
language sql
stable
set search_path = ''
as $$
with
  bounded as (
    select
      -- Clamp so a caller cannot ask for an unbounded scan.
      least(greatest(coalesce(match_count, 8), 1), 50) as n,
      websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  full_text as (
    select
      c.id,
      row_number() over (
        order by ts_rank_cd(c.fts, b.tsq) desc, c.id
      )::integer as rank_ix
    from public.standards_chunks c
    cross join bounded b
    where b.tsq is not null
      and c.fts @@ b.tsq
      and (filter_source is null or c.source = filter_source)
    order by rank_ix
    limit (select n * 4 from bounded)
  ),
  semantic as (
    select
      c.id,
      row_number() over (
        order by c.embedding OPERATOR(extensions.<=>) query_embedding, c.id
      )::integer as rank_ix
    from public.standards_chunks c
    where c.embedding is not null
      and query_embedding is not null
      and (filter_source is null or c.source = filter_source)
    order by rank_ix
    limit (select n * 4 from bounded)
  )
select
  c.id,
  c.source,
  c.doc_title,
  c.section_path,
  c.page_start,
  c.page_end,
  c.content,
  c.context_summary,
  -- k = 60, the smoothing constant from Cormack et al.'s RRF paper; it keeps any
  -- single top-1 hit from dominating a document ranked well by both legs.
  (
    coalesce(1.0 / (60 + s.rank_ix), 0.0)
    + coalesce(1.0 / (60 + f.rank_ix), 0.0)
  )::double precision as score,
  s.rank_ix as semantic_rank,
  f.rank_ix as fulltext_rank
from semantic s
full outer join full_text f on f.id = s.id
join public.standards_chunks c on c.id = coalesce(s.id, f.id)
order by score desc, c.id
limit (select n from bounded);
$$;

comment on function public.search_standards_hybrid is
  'Hybrid retrieval over standards_chunks: reciprocal rank fusion (k=60) of cosine-similarity and full-text rankings. Pass a voyage-3.5 (1024-dim) embedding of the same query_text. filter_source restricts to one source key.';

grant execute on function public.search_standards_hybrid(text, extensions.vector(1024), integer, text)
  to anon, authenticated, service_role;
