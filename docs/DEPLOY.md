# Deploying HAI

HAI runs in two modes from one codebase, selected entirely by environment
variables. Nothing in this document changes how the local build behaves.

| | **Local mode** (default) | **Hosted mode** (public demo) |
|---|---|---|
| Chat model | Ollama, `qwen2.5:14b` | Groq free tier, `qwen/qwen3.8-27b` |
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
vercel link
```

### Where to deploy from

The Next.js project is `app/`, not the repository root, and the live demo is
deployed **from inside `app/`**:

```bash
cd app && vercel deploy --prod
```

That works because `app/content/` holds a vendored copy of the root `content/`
directory. A deploy from `app/` uploads only `app/`, so nothing above it exists
at build time — without the vendored copy the site ships with no guides and no
playbooks. `src/lib/content.ts` prefers the vendored copy and falls back to the
root one.

Deploying from the repository root also works: `vercel.json` and `package.json`
there exist to make the repo root a valid build root, because Vercel resolves
both the package manager and framework detection from a manifest at whatever
directory it builds in. Keep them — a Git-triggered deploy builds from the root
unless the project's Root Directory setting says otherwise, and would fail
without them.

The tidier end state is to set Root Directory to `app` in project settings and
delete one of the two content copies. That is a dashboard setting, so it is left
as a deliberate follow-up rather than something a script does.

### Environment variables

Set each for **Preview** and **Production**
(`vercel env add <NAME> production`, or paste them in the dashboard):

| Variable | Value | Notes |
|---|---|---|
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` | Groq's OpenAI-compatible endpoint |
| `LLM_MODEL` | `qwen/qwen3.8-27b` | must support tool calling — see below |
| `LLM_API_KEY` | `gsk_...` | https://console.groq.com/keys |
| `LLM_REASONING_FORMAT` | `hidden` | **required with `openai/gpt-oss-120b`** — see below |
| `LLM_REASONING_EFFORT` | `none` | skips a reasoning model's hidden chain-of-thought pass; see below |
| `EMBEDDINGS_PROVIDER` | `hf` | switches query embedding off Ollama |
| `HF_TOKEN` | `hf_...` | token with the "Inference Providers" permission |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://REF.supabase.co` | |
| `SUPABASE_ANON_KEY` | the anon key | RLS grants SELECT only; no service role here |
| `MAX_DAILY_REQUESTS` | `500` | shared daily ceiling; default if unset |
| `RATE_LIMIT_RPM` | `20` | per-IP chat pacing; default if unset |
| `LLM_DELIVERABLES_MODEL` | `openai/gpt-oss-120b` | gives `/deliverables` its own daily token budget, separate from chat's — see below |
| `LLM_DELIVERABLES_BASE_URL` | — | optional; only if deliverables should use a different provider entirely |
| `LLM_DELIVERABLES_API_KEY` | — | optional; the key for that other provider |
| `LLM_TOKENS_PER_MINUTE` | — | **no longer needed on Groq or any endpoint that reports its own limits.** Leave unset unless the endpoint enforces a ceiling it does not publish in headers — see below |

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
LLM_MODEL=qwen/qwen3.8-27b \
LLM_API_KEY=gsk_... \
  pnpm test hosted-tool-calling
```

Measured against the free tier on 2026-08-31:

| Model | Result |
|---|---|
| `qwen/qwen3.8-27b` | passes with or without `LLM_REASONING_FORMAT` |
| `openai/gpt-oss-120b` | multi-step step fails unless `LLM_REASONING_FORMAT=hidden` |
| `llama-3.3-70b-versatile` | no longer exists on Groq |

`qwen/qwen3.8-27b` is the deployed default because it is the one that does not
depend on a vendor-specific request parameter to complete a tool loop.

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

`LLM_REASONING_EFFORT=none` is the other half of Groq's reasoning controls, for
models that spend output tokens on hidden chain-of-thought before answering.
Measured against the deployed default, `qwen/qwen3.8-27b`, on 2026-08-31: it
made no measurable difference — identical completion-token counts with and
without it, on both a tool-call step and a direct answer. This model was not
spending reasoning tokens either way. The variable is wired through and left
unset for exactly that reason; it exists so a future switch to a
heavier-reasoning model is one environment variable, not a code change.

### Region: keep the function next to Supabase and Groq, not the US-East default

Vercel Functions default to `iad1` (Washington, D.C.) for every new project.
`hai-demo`'s Supabase project is `eu-central-1` (Frankfurt) and Groq answered
`x-groq-region: fra` (also Frankfurt) — so the default put the function on the
wrong side of the Atlantic from both services it calls on every request
(the daily-cap RPC, the standards-search RPC, and two Groq calls per turn).
`app/vercel.json` pins `"regions": ["fra1"]` to close that gap; Hobby plans get
one function region, which is enough here since both dependencies are already
co-located. Confirm after any redeploy with the `x-vercel-id` response header
(`fra1::…`, not `iad1::…`).

### Groq's free-tier token budget is the real ceiling, not request count

The published free-tier numbers (30 req/min, 1,000 req/day) undersell the
actual constraint. There are two token ceilings, and only one of them is
visible:

- **8,000 tokens per minute** (TPM), reported on every response as
  `x-ratelimit-limit-tokens` alongside `x-ratelimit-remaining-tokens` and
  `x-ratelimit-reset-tokens`.
- **200,000 tokens per day** (TPD), reported *nowhere* — not in any header, not
  in any documented field. The only place the number appears is the prose of a
  429 body:

  > Rate limit reached for model `qwen/qwen3.8-27b` … on tokens per day (TPD):
  > Limit 200000, Used 199754, Requested 2679. Please try again in 17m31.056s.

Both buckets are **per model**. Measured against the deployed key,
`qwen/qwen3.8-27b` and `openai/gpt-oss-120b` each reported their own
independent 8,000 TPM and decremented separately.

The distinction matters because the two failures look identical from outside
and need opposite responses. A per-minute refusal is a pause — wait a few
seconds and the same request succeeds. A per-day refusal is a wall — waiting
out its `retry-after` buys one more call and then another seventeen minutes.
The live failure QA reported was the second kind: the endpoint refused every
request while its own headers still read a healthy
`x-ratelimit-remaining-tokens: 8000`, and `retry-after` climbed past seventeen
minutes because each rejected attempt still counted against the window.

One more trap, worth knowing before it costs an afternoon: the endpoint admits
a request against **prompt + reserved completion tokens**, not against what the
call actually ends up spending. A call that left `maxOutputTokens` unset had the
model's own maximum reserved — 16,384 or 65,536 depending on the model — which
on its own exceeds the 8,000 TPM ceiling, so it was refused no matter how much
real headroom existed (`on tokens per minute (TPM): Limit 8000, Requested
16395`). Every model call in HAI now states an explicit output ceiling.

HAI's system prompt plus its three tool schemas run
to roughly 1,900 tokens, resent in full on every step of the tool-calling loop
— so a single grounded turn (tool-call step + final-answer step) costs
3,000–4,500 tokens, and back-to-back demo traffic exhausts the per-minute
budget in two or three turns. Once that happens Groq does not reject the
request; it queues it, and the user sees tens of seconds of silence with no
error — measured directly during testing: 18–30s stalls appeared the moment
several chat turns landed inside the same 60s window, after single isolated
requests had shown sub-second model latency. `stopWhen: stepCountIs(4)` (down
from 6) bounds how many times a stuck turn can re-send that ~1,900-token
prompt; trimming the prompt itself would buy more headroom but was left alone
here to avoid touching the grounding and safety rules under time pressure —
worth revisiting if demo traffic grows.

### `/deliverables` paces itself against a measured budget, not a guessed one

This is the one route where the free-tier ceilings above change what the product
can do, rather than just making it slower. A situation brief is six sections and
about nineteen model calls with no human in the loop, costing roughly 25,000
tokens in total — three brief-lengths of the per-minute bucket, and an eighth of
the per-day one.

The engine used to pace itself against a *guessed* per-minute spend: estimate
each call's cost from its prompt length, subtract, wait when the running total
approached `LLM_TOKENS_PER_MINUTE`. That estimate cannot see the tool schemas
and tool results the SDK adds on the way out, nor the completion tokens, nor
anything else sharing the same bucket — an eval in another terminal, a chat
request that arrived mid-draft, the SDK's own retries. It ran under, and the
route walked into exactly the refusal it was built to avoid.

The budget is now read off the wire instead. `lib/llm/rate-limit.ts` wraps the
provider's `fetch` and parses `x-ratelimit-*` on every response, so the
per-minute figure is the endpoint's own; 429 bodies are parsed too, which is the
only way to learn the per-day ceiling. Three things follow from that:

- **Pacing switches itself on when an endpoint reports a ceiling, and stays off
  when none is reported.** A local Ollama endpoint is therefore never paced, and
  no URL check is involved in deciding that. A paid tier is paced correctly at
  its real limit with no configuration at all.
- **A per-day exhaustion stops the run** with an honest message, rather than
  retrying into a wall for seventeen minutes at a time.
- **The wait is visible.** The trace panel shows the pacing countdown live
  ("Waiting for the token budget · resumes in Ns"), translated in en/fr/ar/es,
  so a paused run reads as a paused run and not as a hung one.

Measured end to end against the Groq free tier with
`LLM_DELIVERABLES_MODEL=openai/gpt-oss-120b`: a complete six-section Sudan
situation brief in **141.7 seconds, 19 model calls, all six sections populated,
zero 429s**. About 105 of those 142 seconds are deliberate pacing waits — the
route is mostly waiting, on purpose, and that is the correct behaviour on an
8k/min bucket.

Because of that duration, `maxDuration` in
`app/src/app/api/deliverables/route.ts` is **300** — Vercel's ceiling with Fluid
compute — rather than the 60 a Hobby function allows. The engine stops itself 15
seconds before that deadline, so a run that will not finish ends as a truncated
document with a caveat rather than a killed stream. The route streams
incrementally either way, so finished sections are already on the reader's
screen and the page labels a partial document partial.

### Give deliverables its own model

`LLM_DELIVERABLES_MODEL` is optional and defaults to `LLM_MODEL`, but the hosted
demo sets it to `openai/gpt-oss-120b` for a reason that is easy to miss: the TPM
*and* TPD buckets are per model. A brief costs roughly 25,000 tokens, so sharing
one 200,000-token daily bucket with chat means a busy chat afternoon quietly
consumes the ability to produce a document at all. Pointing deliverables at a
second model gives the two features independent daily budgets on the same key
and the same account.

`LLM_DELIVERABLES_BASE_URL` and `LLM_DELIVERABLES_API_KEY` extend that one step
further: the deliverables endpoint can be a different provider entirely, not
just a second model on the same one. Both are optional and fall back to their
`LLM_*` equivalents.

Be honest about the size of the budget this buys. 200,000 tokens a day per model
is roughly **eight briefs per day, per model**, on the free tier. That is enough
for a demo and nothing more; a deployment expecting real traffic needs a paid
tier or a provider with higher daily limits.

### What `LLM_TOKENS_PER_MINUTE` means now

It is no longer needed for an ordinary hosted deployment. Its meaning has
narrowed: it asserts a ceiling for an endpoint that *enforces* one but does not
*report* it in headers. Against Groq, or any endpoint that publishes
`x-ratelimit-*`, the measured number wins and the variable is redundant — leave
it unset. Against a local Ollama, there is no ceiling to assert and it should
stay unset as well.

Local `next dev` and `next start` ignore `maxDuration` entirely, so that
constraint does not apply to the local demo either.

The per-IP limit on this route is **3 runs per 10 minutes**, not
`RATE_LIMIT_RPM`. One run is nineteen model calls and several live API round
trips; twenty a minute would not be a limit. It is a separate counter in
`lib/limits/burst.ts` and is not configurable by environment variable.

---

## What the free tiers actually give you

| | Limit | What happens when it runs out |
|---|---|---|
| Groq, per model | 30 req/min, 1,000 req/day, 8k tokens/min, 200k tokens/day | requests fail; no overage billing |
| Hugging Face Inference | ~$0.10/month credit on a free account | embedding calls fail |
| Supabase free | 500 MB database, pauses after inactivity | project pauses; unpause in dashboard |
| Vercel Hobby | 60s function limit, no commercial use | build rejected above 60s; `/deliverables` asks for 300s and needs Fluid compute |

Both Groq token ceilings are counted per model, which is why
`LLM_DELIVERABLES_MODEL` exists. 200k tokens/day is about eight situation briefs
per model per day — a demo budget, not a production one.

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
