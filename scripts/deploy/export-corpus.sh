#!/usr/bin/env bash
#
# Export the ingested standards corpus from the local Supabase stack into a seed
# file, for loading into a cloud project with load-corpus.sh.
#
# Read-only against the source database: a single SELECT through `\copy`. Safe to
# run while the local stack is serving the app or an eval run.
#
# Why `\copy` and not `pg_dump`:
#   1. pg_dump refuses to dump from a server newer than itself, and the Homebrew
#      client here is a major version behind Supabase's Postgres. `\copy` runs
#      the query server-side and streams the result, so it does not care.
#   2. The output is plain CSV of one table's columns, which load-corpus.sh can
#      stage and UPSERT. A pg_dump archive would only replay as raw INSERTs and
#      would collide with rows that already exist.
#
# The `fts` column is deliberately absent: it is GENERATED ALWAYS and Postgres
# recomputes it on insert. `created_at` is likewise left to the destination.
#
# cost: $0.00 — local database only, no network calls.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${REPO_ROOT}/supabase/seed"
OUT_FILE="${OUT_DIR}/standards_chunks.csv.gz"

# Defaults match `supabase status` for this repo's local stack (see
# supabase/config.toml). Override for a different source.
SOURCE_DB_URL="${SOURCE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54422/postgres}"

# Not named COLUMNS: bash maintains a variable of that name for terminal width
# and will overwrite it, which silently turns the column list below into a number.
SEED_COLUMNS="id, source, doc_title, section_path, page_start, page_end, content, context_summary, embedding"

if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql not found on PATH." >&2
  echo "  macOS: brew install postgresql@16" >&2
  exit 1
fi

echo "Source: ${SOURCE_DB_URL%%\?*}"

# Fail loudly and early rather than writing an empty seed file that only reveals
# itself as empty after a deploy, as a demo that answers every question with
# "the standards corpus is unavailable".
ROW_COUNT="$(psql "${SOURCE_DB_URL}" -tAc \
  "select count(*) from public.standards_chunks where embedding is not null")"

if [ "${ROW_COUNT}" -eq 0 ]; then
  echo "error: no embedded rows in public.standards_chunks — nothing to export." >&2
  echo "  Run the ingestion pipeline first (see ingestion/README.md)." >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"

echo "Exporting ${ROW_COUNT} embedded chunks…"

psql "${SOURCE_DB_URL}" \
  --quiet \
  --no-psqlrc \
  -c "\\copy (select ${SEED_COLUMNS} from public.standards_chunks where embedding is not null order by id) to stdout with (format csv)" \
  | gzip -9 > "${OUT_FILE}"

echo "Wrote ${OUT_FILE} ($(du -h "${OUT_FILE}" | cut -f1))"
echo
echo "Next: SUPABASE_DB_URL='postgresql://…' ./scripts/deploy/load-corpus.sh"
