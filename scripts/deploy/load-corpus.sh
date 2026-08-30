#!/usr/bin/env bash
#
# Load the seed produced by export-corpus.sh into a cloud Supabase project.
#
# Additive, never destructive. Rows are staged and then UPSERTed by primary key,
# so re-running is safe and re-loading a corrected corpus updates the rows it
# covers without touching anything else. Nothing here truncates or drops
# public.standards_chunks — if you need that, do it deliberately and by hand.
#
# Requires the schema to exist already:
#   supabase link --project-ref <ref> && supabase db push
#
# cost: $0.00 — Supabase free tier. The corpus is roughly 45 MB on disk once
# indexed, against a 500 MB free-tier database.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SEED_FILE="${SEED_FILE:-${REPO_ROOT}/supabase/seed/standards_chunks.csv.gz}"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  cat >&2 <<'EOF'
error: SUPABASE_DB_URL is not set.

Get it from the Supabase dashboard: Project Settings -> Database -> Connection
string -> URI. Use the *session pooler* or direct connection, not the
transaction pooler on port 6543 — the transaction pooler does not support the
temporary tables this script stages into.

  SUPABASE_DB_URL='postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres' \
    ./scripts/deploy/load-corpus.sh
EOF
  exit 1
fi

if [ ! -f "${SEED_FILE}" ]; then
  echo "error: seed file not found at ${SEED_FILE}" >&2
  echo "  Run ./scripts/deploy/export-corpus.sh first." >&2
  exit 1
fi

# Not named COLUMNS: bash maintains a variable of that name for terminal width
# and will overwrite it, which silently turns the column list below into a number.
SEED_COLUMNS="id, source, doc_title, section_path, page_start, page_end, content, context_summary, embedding"

echo "Loading ${SEED_FILE} into ${SUPABASE_DB_URL%%@*}@…"

# One psql session, one transaction: the staging table is temporary, so a
# failure anywhere leaves the destination exactly as it was. ON_ERROR_STOP turns
# a mid-stream error into a non-zero exit instead of a silent partial load.
#
# The decompression runs through `\copy ... from program` rather than a pipe into
# psql, because the heredoc below is already psql's stdin — piping the CSV in as
# well makes `from stdin` read the SQL script as data. `\copy` is a client-side
# command, so `from program` needs no database superuser and works against a
# managed Supabase instance.
psql "${SUPABASE_DB_URL}" \
  --quiet \
  --no-psqlrc \
  --single-transaction \
  --set ON_ERROR_STOP=1 <<SQL
create temporary table corpus_seed (
  id uuid,
  source text,
  doc_title text,
  section_path text,
  page_start integer,
  page_end integer,
  content text,
  context_summary text,
  embedding extensions.vector(1024)
) on commit drop;

\copy corpus_seed (${SEED_COLUMNS}) from program 'gunzip -c "${SEED_FILE}"' with (format csv)

insert into public.standards_chunks (${SEED_COLUMNS})
select ${SEED_COLUMNS} from corpus_seed
on conflict (id) do update set
  source          = excluded.source,
  doc_title       = excluded.doc_title,
  section_path    = excluded.section_path,
  page_start      = excluded.page_start,
  page_end        = excluded.page_end,
  content         = excluded.content,
  context_summary = excluded.context_summary,
  embedding       = excluded.embedding;

select source, count(*) as chunks, count(embedding) as embedded
from public.standards_chunks
group by source
order by source;
SQL

echo
echo "Done. Verify retrieval end to end with:"
echo "  psql \"\$SUPABASE_DB_URL\" -c \"select section_path from public.search_standards_hybrid('minimum litres of water per person per day', null, 3, null);\""
