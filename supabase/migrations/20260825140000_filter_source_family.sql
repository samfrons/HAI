-- Let filter_source name a document *family*, not only an exact source key.
--
-- The app models the corpus with three sources -- 'sphere', 'chs', 'iasc' --
-- while standards_chunks stores the three IASC documents separately, because a
-- citation has to name which IASC guidance it came from. Without this, the app
-- cannot express "IASC only" at all: it would have to pass no filter and drop
-- rows client-side, which silently shortens every filtered result set.
--
-- 'iasc' now matches iasc_data_responsibility, iasc_protection and
-- iasc_disability; every exact key still matches only itself. The boundary check
-- is what keeps a family prefix from matching an unrelated key that merely
-- starts with the same letters.

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
      websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      nullif(btrim(coalesce(filter_source, '')), '') as src
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
      and (b.src is null or c.source = b.src or c.source like b.src || '\_%')
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
    cross join bounded b
    where c.embedding is not null
      and query_embedding is not null
      and (b.src is null or c.source = b.src or c.source like b.src || '\_%')
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
  'Hybrid retrieval over standards_chunks: reciprocal rank fusion (k=60) of cosine-similarity and full-text rankings. Pass a 1024-dim embedding of the same query_text, produced by the same model the corpus was embedded with. filter_source accepts an exact source key or a family prefix ("iasc" matches all three IASC documents).';
