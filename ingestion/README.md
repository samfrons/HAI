# Ingestion

Turns the primary humanitarian references in `corpus/` into the rows the app's
`search_standards` tool queries: PDF → heading-aware sections → contextual
chunks → embeddings → Supabase pgvector, searched by hybrid (vector + keyword)
retrieval.

**Everything runs locally and costs nothing.** Embeddings and the contextual
preamble both come from a local Ollama server; the database is a local Supabase
stack. No paid API is called at any point.

## Corpus and licensing

The PDFs are **not** committed. The Sphere Handbook is all-rights-reserved: its
copyright page permits local educational, training and research use but not
redistribution. `corpus/SOURCES.md` records provenance and per-file license
terms for all five documents and stays tracked.

```bash
./fetch-corpus.sh          # download anything missing, verify sha256
./fetch-corpus.sh --check  # verify what is already there
./fetch-corpus.sh --force  # re-download everything
```

The canonical publisher domains sit behind bot-challenge WAFs, so the script
pulls each document from an official secondary mirror (UNHCR's Emergency
Handbook library, the CCCM Cluster's S3 library) and checks it against the
sha256 of the file verified on 2026-08-25.

## Setup

```bash
pnpm install
cp .env.example .env      # then fill in SUPABASE_SERVICE_ROLE_KEY

ollama pull mxbai-embed-large   # 1024-dim embeddings
ollama pull qwen2.5:14b         # contextual preambles

supabase start            # from the repository root; prints the URL and keys
```

`supabase/config.toml` shifts every port by +100 (API `54421`, database `54422`,
Studio `54423`) because the default `5432x` range is already held by another
local Supabase project on this machine.

Environment is read from `ingestion/.env`, falling back to `../app/.env.local`
for anything missing; a variable already exported in the shell always wins.

| Variable | Default | Purpose |
|---|---|---|
| `SUPABASE_URL` | — | Local stack API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Bypasses RLS for writes; never ship to a browser |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local model server |
| `EMBEDDING_MODEL` | `mxbai-embed-large` | Must be 1024-dimensional |
| `CONTEXT_MODEL` | `qwen2.5:14b` | Contextual preamble generation |
| `SKIP_CONTEXTUALIZE` | unset | Set to `1` to store `context_summary = ''` throughout |

## Running

```bash
pnpm ingest                              # extract -> chunk -> contextualize -> embed -> load
pnpm ingest --source=chs,iasc_protection # one or more documents
pnpm ingest --stop-after=chunk           # no models, no database
pnpm ingest --force                      # re-run documents whose hash is unchanged
pnpm search "minimum water supply per person per day"
```

Each stage is gated on what is actually available: with no Ollama server the run
stops after chunking, with no Supabase credentials it stops after embedding, and
it says so rather than failing partway through a document.

`manifest.json` records per-document hashes, counts and stage reached, so an
unchanged document is skipped on the next run. Row ids are deterministic UUIDv5
values derived from the chunk's identity, so re-ingesting upserts onto the same
rows; rows a previous run produced that this run does not are deleted, so a
change to the chunker cannot leave stale citations behind.

## Current state of the loaded corpus

Full run on 2026-08-25 against the local stack: **1,631 chunks, every one
embedded**, no truncated inputs.

| Source | Chunks | Pages |
|---|---:|---|
| `sphere` | 930 | 3–434 |
| `iasc_disability` | 476 | 3–109 |
| `iasc_data_responsibility` | 108 | 3–44 |
| `iasc_protection` | 100 | 2–40 |
| `chs` | 17 | 1–6 |

Embedding the whole corpus takes about 6 minutes on this machine.

**Known gap: `context_summary` is empty for every chunk.** Contextualization was
measured at 50–100 s per chunk on this machine — `qwen2.5:14b` ran at 0.19
tokens/s with ~18% free RAM, because a 9.3 GB model plus everything else makes
the box swap. That is many hours for 1,631 chunks, well past the 45-minute
budget, so the corpus was loaded without preambles. Retrieval works, but without
the contextual-retrieval boost. To fill them in when the machine is idle:

```bash
unset SKIP_CONTEXTUALIZE      # or remove it from .env
ollama stop <any large model> # frees memory; halved embedding time in testing
pnpm ingest --force
```

A smaller context model would make this practical without waiting for an idle
machine.

## How each stage works

**`extract.ts`** — pdf.js (via `unpdf`) text items, grouped into lines and
classified as heading, body or minor (running heads, folios, figure labels,
footnotes; excluded from chunk content). Three corpus-specific problems are
handled:

- *Columns.* The IASC disability guidelines are landscape two-up spreads. Columns
  are found by locating vertical gutters — x ranges that almost no text row
  crosses — with the minimum gutter width scaled to the type size rather than the
  page width, which is what a portrait-derived threshold got wrong.
- *Hyphenation.* The Sphere handbook drops the soft hyphen at a line break
  entirely ("estab" / "lish"), so there is no character to key on. Broken words
  are rejoined using the document itself as a lexicon: a trailing token that
  appears mid-line elsewhere is a real word and is left alone, while a fragment
  that never appears mid-line but whose join does is glued back together.
- *Control characters.* Some fonts map glyphs to control codepoints — U+0007
  where a word space belongs — which was leaking into `section_path` and into
  tsvector lexemes. Those, zero-width characters, and ligatures are normalised.

Heading detection uses type size measured **per page**, not per document: the
IASC protection policy sets its annexes larger than its main text, and a
document-wide modal size classified every line of those annexes as a heading.

**`chunk.ts`** — section-aware. A heading flushes the current chunk, so no chunk
spans two sections and every `section_path` is exact. ~800-token target with 15%
overlap; a tail too small to stand alone is appended to the previous chunk rather
than emitted as a fragment that retrieves badly and cites imprecisely.

**`contextualize.ts`** — Anthropic's contextual retrieval, run locally. Each
chunk gets one or two sentences situating it in its document, so a chunk that
says "a minimum of 15 litres" still retrieves for "Sphere water quantity
standard". The published technique caches the whole document in the prompt;
there is no prompt cache on a local server and the Sphere handbook far exceeds a
14B model's practical context, so the prefix is a digest (title, description,
section outline) instead. `run.ts` times one chunk first and falls back to
`context_summary = ''` for a document projected to exceed a 45-minute budget.

**`embed.ts`** — `mxbai-embed-large` at 1024 dimensions, matching
`standards_chunks.embedding`. The context summary, section path and content are
embedded **together** — contextual retrieval works by embedding the context with
the chunk, not by storing it alongside. Queries carry the model's asymmetric
retrieval prefix (`embedQuery`); omitting it measurably degrades recall, so
callers must use that function rather than embedding a raw query string.

**`load.ts`** — upserts through the service role, which bypasses RLS.

## RPC contract for the app

`app/src/lib/retrieval/search.ts` should call this and nothing else — the schema
and function already exist in `supabase/migrations/`.

**Function:** `public.search_standards_hybrid`

| Argument | Type | Default | Notes |
|---|---|---|---|
| `query_text` | `text` | — | The user's query, unmodified |
| `query_embedding` | `vector(1024)` | — | 1024 floats from `mxbai-embed-large` **with the query prefix**; pass `null` to use the full-text leg alone |
| `match_count` | `integer` | `8` | Clamped server-side to 1..50 |
| `filter_source` | `text` | `null` | An exact source key, or a family prefix — see below |

Returns one row per chunk, ordered by `score` descending:

| Column | Type |
|---|---|
| `id` | `uuid` |
| `source` | `text` |
| `doc_title` | `text` |
| `section_path` | `text` (heading breadcrumb, e.g. `WASH > Water supply > Water supply standard 2.1 > Key indicators`) |
| `page_start`, `page_end` | `integer` |
| `content` | `text` |
| `context_summary` | `text` (may be `''`) |
| `score` | `double precision` |
| `semantic_rank`, `fulltext_rank` | `integer`, null when that leg did not return the row |

Scoring is reciprocal rank fusion (k=60) over a cosine-similarity ranking and a
full-text ranking, rather than a weighted sum of raw scores: cosine distance and
`ts_rank_cd` are not on comparable scales, so any weighting would need retuning
whenever the embedding model changes. Both legs are bounded to `4 × match_count`.

From `@supabase/supabase-js`, over PostgREST, the vector goes as its text form:

```ts
const { data, error } = await supabase.rpc('search_standards_hybrid', {
  query_text: query,
  query_embedding: JSON.stringify(await embedQuery(query)), // 1024 floats
  match_count: 8,
  filter_source: null,
});
```

`ingestion/load.ts` exports `searchStandardsHybrid()` and the `HybridSearchRow`
type as the reference implementation, and `pnpm search "<query>"` exercises it.

### Source keys, and how they map to the app's three

The table stores five source keys, because a citation has to name *which* IASC
guidance a passage came from:

`sphere`, `chs`, `iasc_data_responsibility`, `iasc_protection`, `iasc_disability`

`app/src/lib/retrieval/search.ts` models the corpus with three
(`'sphere' | 'chs' | 'iasc'`). `filter_source` therefore accepts a **family
prefix** as well as an exact key: passing `'iasc'` matches all three IASC
documents, while each exact key still matches only itself. The app can pass its
own enum straight through, and map results back with
`row.source.startsWith('iasc') ? 'iasc' : row.source`.

The app's `StandardsChunk.section` is a single human-readable location string;
compose it from the row rather than adding a column — for example
`` `${row.section_path} (${row.doc_title}, p. ${row.page_start})` ``, falling
back to `doc_title` alone when `section_path` is empty. `content` is
`StandardsChunk.text`, and `score` passes through as-is.

RLS is on: `anon` and `authenticated` may only `SELECT`, and the function is
`security invoker`, so the anon key is safe for read-only search from the app.

## Possible next step: reranking

The machine also has `dengcao/Qwen3-Reranker-4B:Q8_0` in Ollama. A rerank stage
would slot in **after** RRF, not instead of it: call the RPC with
`match_count: 30`, score each `(query, content)` pair with the reranker, and keep
the top 8 by that score. RRF is good at recall and indifferent to fine-grained
ordering, which is exactly what a cross-encoder fixes.

There is already evidence it would help. For `minimum water supply per person
per day`, four of the top five results are the right section — Sphere's Water
supply standard 2.1 — but the chunk that actually answers the question
("Minimum of 15 litres per person per day") ranks **4th**, behind two chunks of
surrounding discussion. Recall is right, ordering is not.

The cost is latency: a 4B cross-encoder scores pairs one at a time, and this
machine is already memory-constrained. It belongs behind a flag and wants
measuring on a set of real queries before being turned on. Not built.
