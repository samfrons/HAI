# HAI app

The Next.js application: chat UI, `/api/chat` route, safety layer, and the
role playbooks / guides content pages. See the [root README](../README.md)
for what HAI is and the full quickstart (models, corpus ingestion, Supabase).
This file covers just this package.

## Key directories

| Path | What's in it |
|---|---|
| `src/app/` | Routes — chat (`/`), playbooks, guides, `/api/chat` |
| `src/lib/tools/` | The three tools the model calls: `search-standards.ts`, `crisis-updates.ts` (IFRC GO / ReliefWeb), `humanitarian-data.ts` (HDX HAPI) |
| `src/lib/retrieval/` | `search.ts` — embeds the query via Ollama and calls the `search_standards_hybrid` Supabase RPC |
| `src/lib/safety/` | `pii.ts` (deterministic regex/heuristic screening), `llm-screen.ts` (optional second-pass), `intercept.ts` (turns findings into the banner copy) |
| `src/lib/prompts/` | `system.ts` (base system prompt), `coach.ts` (coach-mode addition) |
| `src/lib/i18n/` | `locales.ts`, `dictionary.ts`, `context.tsx` — EN/FR/AR/ES UI chrome, RTL for Arabic |
| `src/lib/llm/provider.ts` | The one place the chat/embedding model endpoint is chosen |
| `src/components/` | Chat UI, citations/source panel, playbook and guide views |

## Environment

Copy `.env.example` to `.env.local` and fill in what's marked required below.
Everything else has a working default.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `LLM_BASE_URL` | no | `http://localhost:11434/v1` | OpenAI-compatible chat endpoint |
| `LLM_MODEL` | no | `qwen2.5:14b` | Set to `hai-qwen2.5` after building the 16k-context variant (see root quickstart) |
| `LLM_API_KEY` | no | `ollama` | Ignored by Ollama; required by hosted OpenAI-compatible endpoints |
| `OLLAMA_BASE_URL` | no | `http://localhost:11434` | Used for query embeddings, independent of `LLM_BASE_URL` |
| `EMBEDDING_MODEL` | no | `mxbai-embed-large` | Must match what the corpus was ingested with |
| `NEXT_PUBLIC_SUPABASE_URL` | **yes** | `http://127.0.0.1:54421` | Local Supabase API URL (`supabase status` from repo root) |
| `SUPABASE_ANON_KEY` | **yes** | — | Read-only; RLS grants `search_standards_hybrid` SELECT only |
| `RELIEFWEB_APPNAME` | no | unset | OCHA-approved appname; without it `crisis_updates` falls back to IFRC GO |
| `HDX_APP_IDENTIFIER` | no | demo identifier | Attribution string for HDX HAPI, no registration required |
| `RATE_LIMIT_RPM` | no | unset | Optional abuse control |
| `PII_LLM_SCREEN` | no | `false` | Adds a second-pass LLM classification before every message; off by default because it's a full model round-trip (see `.env.example` for measured latency) |
| `PII_SCREEN_MODEL` | no | `LLM_MODEL` | Model for that second pass |
| `PII_SCREEN_TIMEOUT_MS` | no | `8000` | Fails open on timeout |

## Commands

```bash
pnpm dev          # next dev
pnpm build        # next build
pnpm start        # next start (after build)
pnpm lint         # eslint
pnpm test         # vitest run
pnpm test:watch   # vitest
```
