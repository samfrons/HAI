# Deploying HAI

HAI runs in two modes from one codebase, selected entirely by environment
variables. Nothing in this document changes how the local build behaves.

| | **Local mode** (default) | **Hosted mode** (public demo) |
|---|---|---|
| Chat model | Ollama, `qwen2.5:14b` | Groq free tier, `openai/gpt-oss-120b` |
| Query embeddings | Ollama, `mxbai-embed-large` | Hugging Face Inference, `mxbai-embed-large-v1` |
| Corpus database | local Supabase (`supabase start`) | Supabase cloud, free tier |
| Data leaving the machine | none | prompts go to Groq and Hugging Face |
| Cost | $0.00 | $0.00 on free tiers, with a hard daily cap |

Local mode stays the recommended way to use HAI for real work, and the reason is
in the fourth row: an operational question about a displacement site is exactly
the kind of text that should not be handed to a third-party inference provider.
The hosted demo exists so the project can be *shown* from a link, and it says so
in a banner above the composer.

---

## Part 1 — Database (Supabase cloud)

### 1. Create the project

```bash
supabase login                       # if `supabase projects list` errors
supabase projects create hai-demo --region eu-central-1 --org-id <ORG_ID>
```

`supabase orgs list` gives the org id. **Check the org's plan first.** A free
organization allows two active projects; creating a third in a Pro organization
adds a compute charge per project, silently. If the target org is at its free
limit, make a new free organization in the dashboard rather than adding a
billable project to an existing one.

Note the project ref from the output, then:

```bash
supabase link --project-ref <REF>
```

### 2. Push the schema

```bash
supabase db push
```

This applies all three migrations in `supabase/migrations/`:

- `standards_chunks` — the corpus table, pgvector index, RLS, and the
  `search_standards_hybrid` RPC
- `filter_source_family` — lets `filter_source` name a document family
- `daily_request_cap` — the `daily_usage` table and `claim_daily_request` RPC

They were written against a managed Supabase instance and need no superuser
rights: the `vector` extension is created in `extensions` (already present on
cloud projects), every grant to `anon` / `authenticated` / `service_role` is
explicit rather than inherited, and nothing assumes a local port or role.

### 3. Seed the corpus

The corpus is not in git — the extracted text *is* the Sphere Handbook, which is
all-rights-reserved and not redistributable, the same reason
`ingestion/corpus/*.pdf` is ignored. So the seed is generated from your local
ingested database at deploy time:

```bash
# Read-only against the local stack; safe to run while it is serving.
./scripts/deploy/export-corpus.sh

# Project Settings -> Database -> Connection string -> URI.
# Use the direct connection or session pooler, NOT the transaction pooler
# on port 6543 — it does not support the temp table the loader stages into.
SUPABASE_DB_URL='postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres' \
  ./scripts/deploy/load-corpus.sh
```

The loader stages rows and UPSERTs by primary key inside one transaction. It
never truncates, so re-running it is safe and re-loading a corrected corpus
updates only the rows it covers.

### 4. Verify retrieval before deploying the app

```bash
psql "$SUPABASE_DB_URL" -c \
  "select section_path from public.search_standards_hybrid('minimum litres of water per person per day', null, 3, null);"
```

Passing `null` for the embedding exercises the full-text leg alone, which is
enough to prove the schema, the data, and the RPC. The vector leg is covered by
the app once `HF_TOKEN` is set.

---

## Part 2 — Application (Vercel)

```bash
vercel login                         # if `vercel whoami` errors
vercel link                          # from the repo root
```

`vercel.json` at the repo root points the build at `app/`; the Next.js project is
not at the repository root.

### Environment variables

Set each for **Preview** and **Production**
(`vercel env add <NAME> production`, or paste them in the dashboard):

| Variable | Value | Notes |
|---|---|---|
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` | Groq's OpenAI-compatible endpoint |
| `LLM_MODEL` | `openai/gpt-oss-120b` | must support tool calling — see below |
| `LLM_API_KEY` | `gsk_...` | https://console.groq.com/keys |
| `LLM_REASONING_FORMAT` | `hidden` | **required with a reasoning model** — see below |
| `EMBEDDINGS_PROVIDER` | `hf` | switches query embedding off Ollama |
| `HF_TOKEN` | `hf_...` | token with the "Inference Providers" permission |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://REF.supabase.co` | |
| `SUPABASE_ANON_KEY` | the anon key | RLS grants SELECT only; no service role here |
| `MAX_DAILY_REQUESTS` | `500` | shared daily ceiling; default if unset |
| `RATE_LIMIT_RPM` | `20` | per-IP pacing; default if unset |

`OLLAMA_BASE_URL`, `EMBEDDING_MODEL`, and `PII_SCREEN_MODEL` are local-mode only
and should be left unset in Vercel.

### Deploy

```bash
vercel deploy            # preview
vercel deploy --prod     # production
```

### Choosing the model

**Do not pin `llama-3.3-70b-versatile`.** Groq retired every Llama and Kimi-K2
model on 2026-08-16; a guide naming one will fail with a 404 `model_not_found`.
Check <https://console.groq.com/docs/deprecations> before pinning anything, and
verify the model you choose actually drives HAI's tool loop:

```bash
cd app
LLM_BASE_URL=https://api.groq.com/openai/v1 \
LLM_MODEL=openai/gpt-oss-120b \
LLM_API_KEY=gsk_... \
  pnpm test hosted-tool-calling
```

That test is skipped whenever `LLM_BASE_URL` is local, so `pnpm test` stays
offline by default. It is worth running because the failure it catches is
silent: a model that streams fluent prose while ignoring `search_standards`
produces confident unsourced figures with section numbers attached, which is
worse than an error. HAI has no fallback for that — the grounding contract *is*
the tool call.

### Why `LLM_REASONING_FORMAT=hidden` is not optional here

`openai/gpt-oss-120b` is a reasoning model. It returns its chain of thought as
`reasoning_content`; the AI SDK keeps that on the assistant message and sends it
back on the next step of the tool loop; and Groq then rejects its own field with
`property 'reasoning_content' is unsupported`.

The shape of that failure is the reason it is called out here rather than left
as a footnote. Step one — the `search_standards` call — succeeds. Step two, the
step that would turn the retrieved passages into a cited answer, dies. The user
watches the search complete and then receives nothing. A single-step smoke test
passes against this broken configuration, which is how it reached a deployed
preview once already; the second test in `hosted-tool-calling.test.ts` exists
specifically to catch it, and fails loudly with this variable unset.

Setting it to `hidden` makes the endpoint omit the field, so there is nothing to
echo back. It is deliberately not defaulted on in code: the parameter is Groq's,
and other OpenAI-compatible endpoints reject unknown body fields outright.

---

## What the free tiers actually give you

| | Limit | What happens when it runs out |
|---|---|---|
| Groq, `gpt-oss-120b` | 30 req/min, 1,000 req/day, 8k tokens/min | requests fail; no overage billing |
| Hugging Face Inference | ~$0.10/month credit on a free account | embedding calls fail |
| Supabase free | 500 MB database, pauses after inactivity | project pauses; unpause in dashboard |
| Vercel Hobby | 60s function limit, no commercial use | build rejected above 60s |

The corpus is ~45 MB indexed, comfortably inside Supabase's 500 MB.

Two of those degrade rather than break, on purpose. If the Hugging Face credit is
exhausted, `embedQuery` returns null and `search_standards_hybrid` falls back to
its full-text leg alone — worse recall, still cited, still grounded. If retrieval
fails entirely, the tool returns an instruction telling the model to say the
corpus is unavailable and refuse to state figures from memory.

`MAX_DAILY_REQUESTS` is the backstop for the case none of the above covers: a
free tier being withdrawn or converted to paid overage without notice. It is one
shared counter in Postgres, incremented atomically, so concurrent serverless
instances cannot overshoot it — verified at 30 concurrent claims against a cap of
10 admitting exactly 10.

It **fails open**: if the database is unreachable, requests are allowed rather
than refused, because a Postgres blip should not take the assistant offline to
protect a budget that is not being spent. In that window the ceiling is Groq's
own 1,000/day, which is a hard stop rather than a bill.

The per-IP `RATE_LIMIT_RPM` limiter is in process memory, so on Vercel each
serverless instance holds its own counter and the effective per-IP limit is the
configured number times however many instances are live. It paces one impatient
browser. It is not the spend control, and is not documented as one.

---

## What stays local

**Ollama** — no hosted equivalent is configured and none should be. The local
model is the privacy story, not a fallback.

**The eval suite** (`evals/`) — it drives many long multi-step runs against the
model. Pointed at Groq it would exhaust the 1,000/day free quota in a single
pass, and the results would measure a different model than the one the project
documents. Run evals locally.

**The ingestion pipeline** (`ingestion/`) — it needs the source PDFs, which are
not redistributable and not in git. Cloud gets the *output* of ingestion via
`load-corpus.sh`, never the pipeline itself.

---

## Notes and gotchas

- **The hosted banner is baked at build time.** `/` is prerendered, so
  `isLocalInference()` is evaluated during the build. Changing `LLM_BASE_URL`
  in the Vercel dashboard requires a redeploy before the banner updates.
- **Embedding model compatibility is not checked at runtime.** The corpus was
  embedded with `mxbai-embed-large`; the `hf` provider serves
  `mixedbread-ai/mxbai-embed-large-v1`, the same upstream weights. A different
  1024-dimension model would produce vectors of the right shape in the wrong
  space and every search would silently rank by noise. The embedding client
  rejects wrong-length vectors, which catches a wrong model but not a wrong
  model of the right size — hence hard-coding the model name on the `hf` path.
- **Supabase free projects pause after a week of inactivity.** A demo link that
  worked last month may need the project unpaused before it works again.
