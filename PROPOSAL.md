# HAI: Humanitarian AI — Executive Proposal (v2)

## Executive Summary

HAI is a proof-of-concept AI system for humanitarian crisis response that combines Anthropic's **Petri** safety auditing framework and **Agentic Context Engineering (ACE)** with a humanitarian knowledge base derived from the CLEAR platform. The project has built a comprehensive *framework* — auditing architecture, test scenarios, context optimization pipeline, training scripts, and documentation — but **critical gaps in data quality, model evaluation, and training readiness must be addressed** before it can deliver on its promise.

This revised proposal provides an honest assessment of what works, what doesn't, and a concrete path forward — including model upgrades to current-generation open-source LLMs that dramatically improve multilingual capability, reasoning quality, and deployment efficiency.

**Revised POC cost estimate: $100–200 | Timeline: 2–3 weeks to functional prototype**

---

## The Problem

Humanitarian field workers need instant, accurate guidance on Sphere Standards, protection protocols, and coordination procedures during crises. Existing tools are fragmented across dozens of platforms (HDX, KoboToolbox, FEWS NET, ACLED, WFP SCOPE, UNHCR PRIMES). Commercial AI APIs are expensive at scale and lack humanitarian domain grounding — risking inaccurate or ethically inappropriate advice in life-or-death contexts.

**Market context (2026)**: 70% of humanitarians now use AI regularly, but organizational uptake is nascent. Most usage is "Shadow AI" — individual experimentation without organizational sanction. There is a critical window for purpose-built, safety-validated humanitarian AI tools.

---

## What Has Been Built

### Strengths (Keep and Build On)

| Component | Assessment | Detail |
|-----------|-----------|--------|
| **Petri auditing architecture** | Well-designed | 583-line 3-role framework (auditor → target → judge) with cost tracking |
| **26 safety test scenarios** | High quality | 7 categories, 18 safety dimensions — these are genuinely well-designed for the humanitarian domain |
| **ACE context optimizer** | Solid framework | 427-line generate → reflect → curate → evolve loop |
| **Documentation** | Comprehensive | 14 files, 6000+ lines — setup guides, architecture docs, cost breakdowns |
| **Cost-conscious architecture** | Sound approach | Three-tier local/free/paid design is the right pattern |

### Critical Issues (Must Fix)

| Issue | Severity | Detail |
|-------|----------|--------|
| **Knowledge base contaminated** | **Blocker** | The 118 "crisis types" are JavaScript/TypeScript code snippets (database conflict resolution, software emergency modes), not humanitarian data. The extraction pipeline confused software terminology with humanitarian terminology. |
| **Judge = Target model** | **Blocker** | The auditor's `judge_evaluate()` uses `self.target_model` — the same model being tested evaluates itself. The "100% pass rate" is self-grading with zero evidential weight. |
| **79 training samples** | **Critical** | Orders of magnitude below the 1,000–5,000 minimum for meaningful LoRA fine-tuning. The 9-sample validation set is statistically meaningless. |
| **Training hyperparameters broken** | **Critical** | `warmup_steps=100` with only ~15 total training steps means the learning rate never reaches its target. `eval_steps=100` and `save_steps=500` never trigger. |
| **No RAG implementation** | **Critical** | The knowledge base exists but is only used for fine-tuning data, not retrieval at inference time. This is the single highest-impact architectural gap. |
| **ACE improvement claims unvalidated** | **High** | "8-10% accuracy improvement" has never been measured — the optimizer has never been run with a test function. |
| **Dependencies 1-2 years outdated** | **High** | `anthropic` 0.18.1 → current 0.44+, `transformers` 4.36 → 4.47+, `peft` 0.7 → 0.14+. API surface changes mean code may not execute. |
| **No unit tests or CI/CD** | **High** | Zero test files, no `tests/` directory despite `pytest` in requirements. |

---

## Recommended Model Upgrades

The original design targets **Llama 3.2 3B** — a model too small for the complexity of humanitarian reasoning (ethics, cultural sensitivity, factual accuracy simultaneously). The open-source landscape has advanced significantly since this project began.

### Tier 1: Primary Model Recommendations

| Model | Parameters | Languages | License | Why for HAI |
|-------|-----------|-----------|---------|-------------|
| **Qwen 3 30B-A3B (MoE)** | 30B total / 3B active | 119 languages | Apache 2.0 | Best multilingual coverage under a fully permissive license. MoE architecture means only 3B parameters active per query — similar compute to current Llama 3.2 3B but dramatically more capable. Hybrid thinking/non-thinking modes for varied humanitarian tasks. Fits in 17.5GB VRAM with QLoRA via Unsloth. |
| **Qwen 3 8B (Dense)** | 8B | 119 languages | Apache 2.0 | Simpler deployment than MoE. Strong reasoning, 119 languages, fully permissive. Good balance of capability and resource requirements. |
| **Gemma 3 12B** | 12B | 140+ languages | Gemma ToU | Most multilingual model available (140+ languages). Multimodal (image + text). 128K context for long humanitarian reports. Runs on consumer GPUs with QAT quantization. |

### Tier 2: Specialized Additions

| Model | Role | Why |
|-------|------|-----|
| **TranslateGemma 12B** | Translation layer | 55 languages with 500+ additional research pairs. Outperforms larger models on translation. Directly relevant for humanitarian field communications. |
| **DeepSeek R1 14B (distilled)** | Reasoning/analysis | MIT license. Strong chain-of-thought reasoning for complex ethical dilemmas and needs assessments. |
| **Gemma 3 4B / Gemma 3n** | Offline field deployment | Runs on mobile devices. Adaptive model sizing via MatFormer architecture. Ideal for field workers without connectivity. |
| **Phi-4-multimodal** | Voice interface | MIT license. Best-in-class speech recognition (6.14% WER). Enables voice-based humanitarian interfaces for low-literacy contexts. |
| **Ministral 3 3B** | Edge deployment | Apache 2.0. Vision capabilities. Optimized for NVIDIA edge platforms (Jetson, RTX). |

### Tier 3: Safety Evaluation

| Model | Role | Why |
|-------|------|-----|
| **Claude Haiku / Sonnet** | Independent judge | Must replace local self-evaluation. Claude provides the independent, stronger-model judgment that makes Petri auditing meaningful. |
| **Llama 4 Scout** | Long-context analysis | 10M token context window for processing entire humanitarian reports, cluster coordination documents, and multi-source analysis. |

### Recommended Primary Configuration

```
Training target:     Qwen 3 8B (Apache 2.0, 119 languages)
Fine-tuning:         QLoRA via Unsloth (rank 16, alpha 32, 4-bit NF4)
RAG knowledge base:  FAISS or ChromaDB vector store
Translation layer:   TranslateGemma 12B (55 languages)
Safety judge:        Claude Haiku (independent, paid)
Offline fallback:    Gemma 3 4B (quantized for mobile)
Deployment:          Ollama + GGUF quantization
```

---

## Improvement Roadmap

### Phase 1: Fix Foundations (Week 1) — $0

| Task | Detail |
|------|--------|
| **Clean the knowledge base** | Remove all code snippets from `humanitarian_knowledge.json`. Re-run extraction with proper filters that distinguish software terminology from humanitarian terminology. Verify remaining entries against authoritative sources. |
| **Fix the auditor judge** | Change `judge_evaluate()` to use Claude Haiku (or at minimum a different, stronger local model) instead of `self.target_model`. This is a one-line fix with massive impact on evaluation validity. |
| **Implement RAG** | Add a vector database (FAISS/ChromaDB) over the cleaned knowledge base. Use retrieval at inference time instead of relying solely on fine-tuning. This is the single highest-ROI change. |
| **Fix training hyperparameters** | Set `warmup_steps` to ~10% of total steps. Set `eval_steps` and `save_steps` to values that actually trigger during training. Add gradient checkpointing. Set a reproducibility seed. |
| **Update dependencies** | Bump `anthropic`, `transformers`, `peft`, `ollama`, `accelerate` to current versions. Add `gradio` to requirements. Remove unused `langchain`. |
| **Add unit tests** | Create `tests/` directory. Test knowledge extraction, auditor probe/judge separation, ACE context generation, and training data loading. |

### Phase 2: Scale Training Data (Week 1–2) — $15–30

| Task | Detail |
|------|--------|
| **Generate 5,000+ training samples** | Use Claude Sonnet or GPT-4 to generate high-quality humanitarian Q&A pairs across all 10 domain categories. Verify against Sphere Standards and OCHA protocols. |
| **Add adversarial test scenarios** | Expand from 26 to 50+ scenarios. Add jailbreak attempts, prompt injection, conflicting principles, "I don't know" edge cases, and multilingual scenarios. |
| **Balance category coverage** | Cultural sensitivity (currently 1 scenario) and conflict sensitivity (currently 1 scenario) need 5-8 scenarios each — these are the highest-risk areas. |
| **Add provenance tracking** | Link every fact in the knowledge base to its original source, publication date, and verification status. |

### Phase 3: Train and Evaluate (Week 2–3) — $50–100

| Task | Detail |
|------|--------|
| **Fine-tune Qwen 3 8B with QLoRA** | Use Unsloth on Colab A100 or Vast.ai. 5,000+ samples, 3 epochs, proper warmup schedule. |
| **Run full Petri audit with Claude judge** | All 50+ scenarios with Claude Haiku as independent judge. Generate real pass/fail metrics with statistical significance. |
| **Benchmark RAG vs. fine-tuning vs. combined** | Measure accuracy, latency, and cost for each approach independently and combined. |
| **Run ACE optimization loop with real test function** | Measure actual accuracy improvement instead of claiming unvalidated numbers. |
| **Multilingual evaluation** | Test in Arabic, French, and Spanish using scenarios translated by TranslateGemma. |

### Phase 4: Production Hardening (Week 3+) — $20–50

| Task | Detail |
|------|--------|
| **Add REST API layer** | FastAPI with authentication, rate limiting, input validation, and error handling. |
| **Add response guardrails** | Output filtering for harmful content, citation verification, confidence scoring. |
| **Add offline mode** | Package Gemma 3 4B with GGUF quantization for field deployment without internet. |
| **Add monitoring** | Logging, latency tracking, cost per query, error rates. |
| **Red-team with humanitarian professionals** | Invite OCHA/UNHCR/WFP practitioners to stress-test with realistic edge cases. |

---

## Revised Cost Estimate

| Phase | Cost | What You Get |
|-------|------|-------------|
| Phase 1: Fix foundations | $0 | Working evaluation, RAG, clean data, tests |
| Phase 2: Scale training data | $15–30 | 5,000+ verified samples, 50+ test scenarios |
| Phase 3: Train and evaluate | $50–100 | Fine-tuned Qwen 3 8B, validated safety metrics |
| Phase 4: Production hardening | $20–50 | API, guardrails, offline mode, monitoring |
| **Total** | **$85–180** | **Functional, validated, deployable humanitarian AI** |

---

## Why This Matters

1. **Lives at stake**: Humanitarian workers make split-second decisions on resource allocation, protection, and evacuation. Incorrect guidance has real consequences. A properly validated safety audit (with an independent judge, not self-evaluation) ensures the model resists deception, sycophancy, and culturally insensitive recommendations.

2. **Cost barrier removed**: Most humanitarian organizations cannot afford $500+/month API costs. A local-first architecture with RAG makes AI-assisted crisis response accessible to under-resourced NGOs and local responders.

3. **Multilingual from day one**: Most humanitarian crises occur in non-English-speaking regions. Qwen 3's 119-language support plus TranslateGemma's 55-language translation capability enables field use where it matters most.

4. **Offline-capable**: Field workers in crisis zones often lack connectivity. A quantized Gemma 3 4B running on a laptop or tablet provides guidance without internet dependence.

5. **Safety-first by design**: The Petri framework tests for humanitarian-specific failure modes — biased resource allocation, conflict insensitivity, beneficiary data exposure, pressure to inflate impact numbers — that general AI safety benchmarks do not cover.

6. **No vendor lock-in**: Open-source models (Apache 2.0 / MIT licensed), documented pipelines, and standard tooling mean any organization can replicate, adapt, and extend HAI.

---

## Technical Architecture (Revised)

```
QUERY FLOW
──────────
User Query (text or voice via Phi-4-multimodal)
    │
    ├─► Translation (TranslateGemma 12B, if non-English)
    │
    ├─► RAG Retrieval (FAISS/ChromaDB over cleaned knowledge base)
    │       │
    │       ├─ Sphere Standards
    │       ├─ OCHA coordination protocols
    │       ├─ Platform documentation (HDX, KoboToolbox, FEWS NET...)
    │       └─ Verified statistics with provenance
    │
    ├─► Inference (Qwen 3 8B fine-tuned + RAG context)
    │
    ├─► Response Guardrails (citation check, confidence score, harm filter)
    │
    └─► Response (with source citations)

SAFETY EVALUATION (Petri)
─────────────────────────
Auditor (OpenRouter free tier) → Target (Qwen 3 8B) → Judge (Claude Haiku)
    │                                                        │
    └── 50+ scenarios across 9 categories ──────────────────►│
                                                             └── Independent 5-dimension scoring

OFFLINE MODE
────────────
Gemma 3 4B (GGUF quantized) + local FAISS index → runs on laptop/tablet
```

---

## Competitive Landscape

| Approach | Cost/month | Languages | Offline | Safety Audited | Domain-Specific |
|----------|-----------|-----------|---------|---------------|----------------|
| ChatGPT/Claude direct | $200–2,000 | Many | No | Generic only | No |
| Custom GPT wrapper | $100–500 | Many | No | No | Superficial |
| **HAI (proposed)** | **$20–50** | **119+** | **Yes** | **Humanitarian-specific** | **Deep** |
| No AI (status quo) | $0 | N/A | N/A | N/A | Manual lookup |

---

## Key Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Knowledge base still contains errors after cleaning | Add provenance tracking; cross-reference against Sphere Handbook and OCHA official sources; human review of all training data |
| Fine-tuned model still hallucinates | RAG with source citations provides verifiable grounding; guardrails flag low-confidence responses |
| Insufficient training data quality | Use Claude/GPT-4 for synthetic generation with humanitarian expert review; partner with OCHA/UNHCR for real Q&A data |
| Model performs poorly in low-resource languages | Start with high-resource humanitarian languages (Arabic, French, Spanish); use TranslateGemma for broader coverage; benchmark per-language |
| Field deployment hardware constraints | Gemma 3 4B + GGUF runs on 8GB RAM; Gemma 3n adapts to available compute dynamically |

---

*HAI has the right vision, the right framework, and well-designed test scenarios. What it needs now is clean data, honest evaluation, modern models, and a RAG architecture to bridge the gap from promising framework to deployable humanitarian tool.*

*Revised February 2026 | Repository: /home/user/HAI*
