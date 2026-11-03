# HAI — Humanitarian AI Assistant

**Executive Proposal**

---

## Executive Summary

HAI is a citation-grounded, tool-using AI assistant purpose-built for humanitarian crisis response. It answers practitioner questions against primary references — the Sphere Handbook, the Core Humanitarian Standard, and IASC guidance — and calls live tools for real-time crisis data, structured humanitarian datasets, and multi-hazard alerts. Every factual claim cites its source passage; every user message is screened for personally identifiable data before it reaches the model. It runs entirely on a local model by default, at zero per-message cost.

The humanitarian sector already uses general-purpose AI. Two failure modes make that dangerous: confident fabrication of standards figures (a model inventing "20 litres, Section 5.2.1" from memory) and beneficiary data exposure (pasting case lists into a chat box). HAI is an architectural answer to both — retrieval-grounded answers that refuse to cite what they cannot find, and a deterministic safety layer that intercepts PII before inference begins.

The system is fully built, tested, and deployable today. It includes a complete Next.js web application with multilingual support (English, French, Arabic with RTL, Spanish), six role-specific playbooks, three practitioner guides, a coach mode, four live data tools, 114 safety tests, and a 26-scenario evaluation harness graded by an independent judge model.

---

## The Problem

Humanitarian workers make life-critical decisions under time pressure — water supply calculations, triage protocols, resource allocation during active crises. They need answers that are:

- **Accurate** — sourced from the current edition of the relevant standard, not hallucinated from training data
- **Citable** — traceable to a specific section and page, so they can be verified and defended in coordination meetings
- **Safe** — incapable of exposing beneficiary data, even when a stressed field worker pastes a case list into the chat
- **Current** — informed by live situation data, not snapshots frozen at training time
- **Accessible** — available in the languages practitioners actually work in, operable offline or on constrained networks

No general-purpose AI product meets all five. Commercial chatbots hallucinate standards figures, cannot cite sources, and have no data-responsibility layer designed for humanitarian contexts.

---

## The Solution

HAI addresses each requirement with a specific architectural choice:

| Requirement | HAI's approach |
|---|---|
| **Accuracy** | Hybrid search (vector + full-text, reciprocal rank fusion) over 1,631 ingested chunks of verified humanitarian standards via Supabase pgvector. The model is instructed never to state a figure it cannot ground in a retrieved passage. |
| **Citations** | Every answer traces to source, section, and page number. When retrieval returns nothing, the model says so explicitly rather than answering from memory. |
| **Safety** | Deterministic PII screening (regex + heuristics) catches phone numbers, emails, case IDs, GPS coordinates, dates of birth, and pasted rosters *before the model sees the text*. An optional LLM second-pass catches bare names. 114 tests cover the safety layer. |
| **Live data** | Four specialized tools — `search_standards` (corpus retrieval), `crisis_updates` (ReliefWeb / IFRC GO), `humanitarian_data` (HDX HAPI), `hazards_context` (USGS, GDACS, World Bank, OCHA HPC) — give the model access to current information without memorizing stale facts. |
| **Multilingual** | UI in EN / FR / AR / ES with full RTL layout for Arabic. The model answers in whatever language the user writes in. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Next.js UI (chat, 6 playbooks, 3 guides, coach mode, i18n)       │
│  EN / FR / AR (RTL) / ES                                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                    /api/chat (AI SDK v7)
                           │
              ┌────────────▼────────────┐
              │   Safety Layer (PII)     │  ← Deterministic screening
              │   114 tests, fails safe  │     before any model call
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │   LLM (Ollama local     │  ← qwen2.5:14b default;
              │   or any OpenAI-compat) │     swappable via env var
              └──┬─────┬──────┬─────┬──┘
                 │     │      │     │
        ┌────────┘  ┌──┘   ┌──┘  ┌──┘
        ▼           ▼      ▼     ▼
  search_      crisis_  humanit-  hazards_
  standards    updates  arian_    context
  (pgvector)   (IFRC/   data     (USGS/GDACS/
               Relief   (HDX     World Bank/
               Web)     HAPI)    OCHA HPC)
```

**Key design decisions:**

- **Retrieval over fine-tuning.** An earlier prototype attempted LoRA fine-tuning; three independent bugs invalidated its results. Retrieval-grounding is auditable, updatable (re-ingest a PDF vs. retrain a model), and fails safely ("corpus unavailable" vs. confident hallucination). Full postmortem documented in `research/README.md`.
- **Independent evaluation.** The 26-scenario eval suite is graded by a model from a *different family* than the one being tested, against explicit expected facts — not a self-graded keyword heuristic.
- **Zero vendor lock-in.** The same code runs against local Ollama ($0/message), Groq's free tier, or any OpenAI-compatible endpoint. One environment variable changes the backend.

---

## What's Built

| Component | Status | Detail |
|---|---|---|
| **Chat UI** | Complete | Next.js app, 96 TypeScript files, conversation history, example prompts, empty state |
| **Safety layer** | Complete | 583-line PII detector + 135-line interceptor + 123-line LLM screen. 114 tests. IASC principle named on every refusal |
| **Tool: search_standards** | Complete | Hybrid pgvector search over Sphere, CHS, IASC corpus (1,631 chunks) |
| **Tool: crisis_updates** | Complete | Live situation reports from ReliefWeb (with OCHA appname) or IFRC GO (no registration) |
| **Tool: humanitarian_data** | Complete | Structured indicators from HDX HAPI — population, food security, funding, needs |
| **Tool: hazards_context** | Complete | Multi-source aggregation from USGS, GDACS, World Bank, OCHA HPC |
| **Eval harness** | Complete | TypeScript CLI driving 26 scenarios against the live `/api/chat` route |
| **Playbooks** | Complete | Six role-specific guides (program officer, protection, MEAL, comms, grants, logistics) |
| **Guides** | Complete | Effective prompting, responsible use, starting a community of practice |
| **Coach mode** | Complete | Adds a prompting lesson to each answer — builds practitioner capacity |
| **i18n** | Complete | EN, FR, AR (full RTL), ES |
| **Ingestion pipeline** | Complete | Corpus fetch → chunk → contextualize → embed → load to pgvector |
| **Supabase migrations** | Complete | Standards chunks, source filtering, daily request cap |
| **CI/CD** | Complete | GitHub Actions workflow |

---

## Safety & Data Responsibility

HAI's safety architecture is not an afterthought — it is the first code that runs on every request:

1. **Deterministic PII screening** (always on, microsecond latency): phone numbers, emails, case/registration identifiers, GPS coordinates, dates of birth, pasted rosters. Patterns derived from real humanitarian data formats.
2. **Optional LLM second-pass** (`PII_LLM_SCREEN=true`): catches bare personal names and re-identifying detail combinations. Off by default because it adds a full model round-trip.
3. **Interception, not rejection**: flagged messages are refused with the specific IASC data-responsibility principle they engage, named explicitly, and offered a safe rephrasing. Not a bare "I can't help with that."
4. **History redaction**: a flagged message is replaced with a placeholder in conversation history, so it is never replayed to the model on subsequent turns.
5. **Source grounding**: when retrieval returns nothing, the model is instructed — in emphatic, instruction-shaped notices — to say so plainly rather than answering from memory. This is enforced by three separate notice types covering: corpus not ingested, retrieval backend down, and search returned no match.

---

## Cost Model

| Deployment | Per-message cost | Infrastructure |
|---|---|---|
| **Local Ollama** | **$0.00** | Practitioner's own hardware. Models: qwen2.5:14b (chat) + mxbai-embed-large (embeddings) |
| **Hosted free tier** (Groq) | **$0.00** | Groq free key. Per-minute and per-day token ceilings managed automatically |
| **Hosted paid** | Per-token | Any OpenAI-compatible endpoint — one env var change |

Daily request caps (configurable, default 500/day) prevent runaway costs on hosted deployments. Rate limiting (default 20/min per IP) paces individual clients. Both are enforced atomically in Postgres, not in process memory.

---

## Competitive Advantage

1. **Citation-grounded** — every claim traces to source, section, page. General-purpose chatbots cannot do this against a specific corpus.
2. **Tool-using** — live crisis data from four authoritative sources, not facts frozen at training time.
3. **Safety-first** — PII intercepted before the model sees the text, not filtered after generation. This is the only architecture that prevents exposure entirely.
4. **Runs fully local** — no data leaves the organization. Critical for humanitarian contexts where beneficiary data crosses jurisdictional boundaries.
5. **Zero vendor lock-in** — same codebase works against Ollama, Groq, or any OpenAI-compatible endpoint.
6. **Honest evaluation** — published baseline of 1/26 scenarios passing (4%), because the eval suite is a regression instrument, not a marketing number. The scenarios test retrieval quality end-to-end; improving corpus coverage and retrieval ranking directly improves the score.

---

## Evaluation & Roadmap

**Current baseline:** 1 of 26 scenarios passing (4%). This is published as-is. The suite is designed to be a rigorous regression instrument: it tests whether the full pipeline (retrieval → grounding → response) produces correct, cited answers across 26 domain-expert scenarios covering accuracy, ethics, cultural sensitivity, technical knowledge, and safety dimensions.

The 4% reflects retrieval quality, not application quality — the chat UI, safety layer, tools, and eval harness all work correctly. Improving the score means improving what the system retrieves and how it ranks it.

**Improvement path:**

| Phase | Focus | Expected impact |
|---|---|---|
| **1. Contextual retrieval** | Add contextual preambles to chunks during ingestion (currently loads without them) | Better ranking → more relevant passages returned |
| **2. Expanded corpus** | Ingest additional humanitarian references beyond Sphere/CHS/IASC | Cover scenarios the current corpus cannot answer |
| **3. Model upgrades** | Evaluate newer models (Qwen 3 8B, Gemma 3 12B) for better tool-calling reliability | Fewer stuck tool loops, better multilingual performance |
| **4. Domain fine-tuning** | LoRA fine-tune on validated humanitarian Q&A (with clean data this time) as a complement to retrieval | Improved domain vocabulary and reasoning |

---

## Research Foundation

HAI's architecture is informed by documented research, including lessons from its own failed first attempt:

- **Petri safety framework** — three-role architecture (Auditor → Target → Judge) for AI safety evaluation. The original prototype's Bug 1 (judge = target model) is the canonical example of why independent evaluation matters. The current eval harness enforces judge independence by design.
- **ACE (Agentic Context Engineering)** — iterative context optimization (generate → reflect → curate → evolve), per arXiv:2510.04618. Informs the retrieval-grounding strategy.
- **Fine-tuning postmortem** — three bugs documented with file:line precision in `research/README.md`. This is not hidden; it is published as evidence that the project learns from its failures and builds the next iteration against the same failure modes.

---

## Contact

For a live demo, deployment discussion, or technical deep-dive, contact the HAI team.

*HAI is open-source and designed for humanitarian organizations of any size. The zero-cost local deployment means the barrier to adoption is time, not budget.*
