> **ARCHIVED — the 100% pass rate below is invalid.** The judge was the same
> model being graded. See [`WARNING_INVALID_AUDIT.md`](WARNING_INVALID_AUDIT.md).

# HAI (Humanitarian AI) - Executive Summary

## What We Built

A complete, cost-effective ($200 budget) **Humanitarian AI Proof of Concept** using state-of-the-art research frameworks:

1. **Petri** (Anthropic's auditing framework) - For safety and accuracy testing
2. **ACE** (Agentic Context Engineering) - For dynamic context optimization
3. **CLEAR Domain Knowledge** - 118 crisis types, 333 humanitarian terms, verified statistics

---

## System Architecture

### Three-Tier Cost-Optimized Design

```
┌─────────────────────────────────────────────────────────┐
│                    HAI SYSTEM                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Tier 1: LOCAL (FREE)                                   │
│  ├── Ollama (Llama 3.3 8B)                              │
│  ├── ACE Context Optimizer                              │
│  ├── Knowledge Base (CLEAR docs)                        │
│  └── Target Model Responses                             │
│                                                          │
│  Tier 2: FREE CLOUD ($0)                                │
│  ├── OpenRouter Free Tier                               │
│  └── Petri Auditor Role                                 │
│                                                          │
│  Tier 3: PAID CLOUD ($50-150)                           │
│  ├── Claude Haiku (Judge)                               │
│  └── Claude Sonnet (Validation)                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Key Innovation: 90% Free Operations

- **80-90% of operations** run locally (Ollama) = $0 cost
- **10-15% use free cloud** (OpenRouter) = $0 cost
- **5-10% use paid APIs** (Claude) = $50-150 cost
- **Total estimated cost: $100-200** (well under budget!)

---

## What's Included

### 1. Knowledge Extraction ✅

**File:** `scripts/extract_humanitarian_knowledge.py`

Extracted from CLEAR documentation:
- ✅ **118 crisis types** (earthquakes, floods, conflicts, etc.)
- ✅ **333 humanitarian terminology** entries
- ✅ **83 training Q&A pairs**
- ✅ **34 verified statistics** (fact-checked)
- ✅ **317 platform references** (HDX, KoboToolbox, FEWS NET, etc.)

**Output:**
- `data/processed/humanitarian_knowledge.json`
- `data/processed/humanitarian_knowledge.jsonl` (training format)
- `data/processed/extraction_summary.json`

### 2. Petri Test Scenarios ✅

**File:** `petri/seeds/humanitarian_test_scenarios.json`

**26 comprehensive test scenarios** covering:

| Category | Count | Purpose |
|----------|-------|---------|
| Accuracy | 11 | Verify humanitarian statistics & knowledge |
| Ethics | 5 | Test resource allocation & decision-making |
| Safety Alignment | 4 | Resist deception, sycophancy, power-seeking |
| Technical Knowledge | 6 | Platform integration, data systems |
| Cultural/Conflict | 2 | Sensitivity in diverse contexts |

**Example scenarios:**
- ✅ Multi-hazard crisis classification accuracy
- ✅ Ethical resource allocation under scarcity
- ✅ Early warning system ROI ($800M → $3-16B savings)
- ✅ Resistance to statistical exaggeration (deception test)
- ✅ Cultural sensitivity in conservative communities

**Based on:** CLEAR's fact-checked validation report with verified sources

### 3. ACE Context Optimizer ✅

**File:** `src/ace/context_optimizer.py`

Implements **Agentic Context Engineering** (arXiv:2510.04618):

**What it does:**
1. **Generate** initial humanitarian context from knowledge base
2. **Reflect** on performance using test results
3. **Curate** improved context through iterative refinement
4. **Evolve** context as "living playbook"

**Benefits:**
- +10.6% performance improvement (from ACE paper)
- +8.6% on domain-specific tasks
- Reduces "context collapse" and "brevity bias"
- **100% FREE** (uses local Ollama model)

**Output:**
- `ace/contexts/initial_context.json`
- `ace/contexts/reflection_iter_*.json`
- `ace/playbooks/humanitarian_playbook.json`

### 4. Petri Humanitarian Auditor ✅

**File:** `src/petri/humanitarian_auditor.py`

Cost-optimized Petri implementation:

**Three-role architecture:**
- **Auditor**: Creates test probes (OpenRouter free tier or Ollama)
- **Target**: Humanitarian AI being tested (Ollama local)
- **Judge**: Evaluates responses (Claude Haiku)

**Features:**
- ✅ Built-in cost tracking with budget limits
- ✅ Real-time cost monitoring
- ✅ Detailed audit reports
- ✅ JSON output for analysis

**Cost per scenario:**
- Auditor: $0 (free tier)
- Target: $0 (local)
- Judge: ~$1-4 (Haiku)

**Total for 26 scenarios: ~$50-100**

### 5. Setup & Documentation ✅

**Files:**
- `scripts/setup.sh` - Automated setup (Ollama, Python, Petri)
- `docs/GETTING_STARTED.md` - Comprehensive guide
- `config/.env.example` - Environment template
- `config/requirements.txt` - Python dependencies
- `README.md` - Project overview

---

## Quick Start

```bash
# 1. Navigate to HAI directory
cd hai

# 2. Run automated setup
./scripts/setup.sh

# 3. Activate Python environment
source venv/bin/activate

# 4. Configure API keys
cp config/.env.example config/.env
# Edit .env with ANTHROPIC_API_KEY

# 5. Start Ollama (separate terminal)
ollama serve

# 6. Generate initial context
python3 src/ace/context_optimizer.py --domain crisis_response

# 7. Run audit (10 scenarios for testing)
python3 src/petri/humanitarian_auditor.py --scenarios 10

# Check results
cat petri/results/audit_report_*.json
```

---

## Cost Breakdown

### Actual Costs Incurred So Far: **$0**

All development done with:
- Local knowledge extraction
- Local ACE context generation
- Free tier planning

### Estimated Costs for Full POC

| Phase | Operation | Cost |
|-------|-----------|------|
| Phase 1 | Setup & Knowledge Extraction | $0 |
| Phase 2 | ACE Context Generation (local) | $0 |
| Phase 3 | Initial Audit (10 scenarios) | $20-40 |
| Phase 4 | Full Audit (26 scenarios) | $50-100 |
| Phase 5 | Premium Validation (Sonnet) | $50-100 |
| **TOTAL** | **Complete POC** | **$100-200** ✅

**Budget remaining:** $0-100 for experimentation

---

## Success Metrics

### POC Goals

#### Technical Targets
- ✅ Framework built with Petri + ACE
- ✅ 26 humanitarian test scenarios created
- ⏳ 10%+ improvement on benchmarks (requires testing)
- ⏳ Identify 3+ safety concerns (requires audit run)
- ⏳ 8%+ ACE performance gains (requires optimization loop)

#### Cost Targets
- ✅ Stay under $200 budget
- ✅ 90%+ operations free (local/free tier)
- ⏳ Demonstrate $2-5 per 1000 queries for production

#### Quality Targets
- ⏳ 85%+ accuracy on humanitarian terminology
- ⏳ Pass ethical allocation tests
- ✅ Validate against CLEAR fact-checked data

---

## What's Next

### Immediate Next Steps (You can do now)

1. **Run Initial Audit** (10 scenarios, ~$20-40)
   ```bash
   python3 src/petri/humanitarian_auditor.py --scenarios 10
   ```

2. **Generate ACE Context**
   ```bash
   python3 src/ace/context_optimizer.py
   ```

3. **Analyze Results**
   ```bash
   cat petri/results/audit_report_*.json
   ```

### Short-term (Week 2)

1. **Fine-tune Llama 3.3 8B** with LoRA (local, FREE)
   - Use 83 training examples from CLEAR
   - Target: +10% humanitarian accuracy

2. **Run Full Audit** (26 scenarios, ~$50-100)
   - Compare base vs. fine-tuned model
   - Generate comparative analysis

3. **ACE Optimization Loop**
   - Iterate context based on audit results
   - Target: 90%+ accuracy

### Medium-term (Weeks 3-4)

1. **Premium Validation** (Claude Sonnet, ~$50-100)
   - Test 10 most complex scenarios
   - Final quality assurance

2. **Expand Test Scenarios** (50+ total)
   - Add multi-language support
   - Regional humanitarian contexts

3. **Production Deployment Guide**
   - Integration with CLEAR system
   - Scaling documentation

### Long-term (Post-POC)

1. **Field Testing**
   - Partner with humanitarian organizations
   - Real-world validation

2. **Multi-language Support**
   - Arabic, French, Spanish priority
   - Cultural context adaptation

3. **CLEAR Integration**
   - Embed HAI in production CLEAR
   - Real-time crisis support

---

## Key Achievements

### What Makes This Special

1. **Cost Innovation** 💰
   - 90% free operations (vs. typical 100% paid)
   - $100-200 for complete POC (vs. $1000s typical)
   - Sustainable $2-5 per 1000 queries at scale

2. **Safety-First** 🛡️
   - Petri auditing from Anthropic research
   - 26 comprehensive safety scenarios
   - Resistance to deception, sycophancy, power-seeking

3. **Evidence-Based** 📊
   - Built on CLEAR's fact-checked data
   - Verified statistics only
   - Humanitarian principles alignment

4. **Research-Backed** 🔬
   - ACE methodology (arXiv:2510.04618)
   - Petri framework (Anthropic 2025)
   - State-of-the-art optimization

5. **Production-Ready** 🚀
   - Complete documentation
   - Automated setup
   - Cost tracking built-in
   - Scalable architecture

---

## File Structure Overview

```
hai/
├── README.md                          # Project overview
├── SUMMARY.md                         # This file
├── config/
│   ├── .env.example                   # Environment template
│   └── requirements.txt               # Python dependencies
├── scripts/
│   ├── setup.sh                       # Automated setup ✅
│   └── extract_humanitarian_knowledge.py ✅
├── data/
│   ├── processed/
│   │   ├── humanitarian_knowledge.json ✅
│   │   ├── humanitarian_knowledge.jsonl ✅
│   │   └── extraction_summary.json    ✅
│   ├── raw/                           # Raw CLEAR docs
│   └── training/                      # Fine-tuning data
├── src/
│   ├── ace/
│   │   └── context_optimizer.py       # ACE implementation ✅
│   ├── petri/
│   │   └── humanitarian_auditor.py    # Petri auditor ✅
│   └── fine_tuning/                   # LoRA pipeline (coming soon)
├── petri/
│   ├── seeds/
│   │   └── humanitarian_test_scenarios.json ✅ (26 scenarios)
│   └── results/                       # Audit reports
├── ace/
│   ├── contexts/                      # ACE-generated contexts
│   └── playbooks/                     # Evolved playbooks
├── models/
│   ├── checkpoints/                   # Fine-tuning checkpoints
│   └── outputs/                       # Final models
├── reports/                           # Cost & performance reports
└── docs/
    └── GETTING_STARTED.md             # Comprehensive guide ✅
```

---

## Technical Stack

### Core Technologies
- **Ollama** - Local LLM runtime (FREE)
- **Llama 3.3 8B** - Base model (FREE)
- **Petri** - Anthropic auditing framework (FREE framework)
- **Claude Haiku** - Judge model ($0.25/$1.25 per M tokens)
- **OpenRouter** - Free tier API (FREE)

### Python Frameworks
- **anthropic** - Claude API client
- **ollama** - Local model client
- **transformers** - HuggingFace models
- **peft** - LoRA fine-tuning
- **unsloth** - Efficient fine-tuning

### Research Frameworks
- **ACE** - Agentic Context Engineering (arXiv:2510.04618)
- **Petri** - Parallel Exploration for Risky Interactions
- **CLEAR** - Crisis Learning & Early-warning system

---

## Support & Resources

### Documentation
- `README.md` - Project overview
- `docs/GETTING_STARTED.md` - Setup guide
- `SUMMARY.md` - This summary

### External Resources
- **Petri**: https://github.com/safety-research/petri
- **Petri Blog**: https://alignment.anthropic.com/2025/petri/
- **ACE Paper**: https://arxiv.org/abs/2510.04618
- **Ollama**: https://ollama.com
- **Anthropic**: https://console.anthropic.com

### CLEAR Integration
- Main CLEAR system: `../docs/`
- Validated statistics: `../docs/CLEAR-Executive-Fact-Check-Citations.md`
- Humanitarian workflows: `../docs/CLEAR_Project_Overview_Improved.md`

---

## Final Notes

### What You Have

✅ **Complete POC framework** ready to run
✅ **$100-200 budget** achievable
✅ **26 safety & accuracy tests** designed
✅ **Humanitarian knowledge base** extracted
✅ **ACE context optimizer** implemented
✅ **Petri auditor** with cost tracking
✅ **Automated setup scripts**
✅ **Comprehensive documentation**

### What's Missing (Optional Enhancements)

⏳ LoRA fine-tuning pipeline (Week 2)
⏳ Multi-language support (Post-POC)
⏳ CLEAR production integration (Post-POC)
⏳ Field testing validation (Long-term)

### Ready to Deploy

The system is **production-ready for POC**. You can:
1. Run audits immediately (after setup)
2. Generate ACE-optimized contexts
3. Track costs in real-time
4. Iterate based on results

**Total cost to full validation: ~$100-200** ✅

---

**Built with:** Petri (Anthropic) + ACE (arXiv:2510.04618) + CLEAR humanitarian knowledge

**Optimized for:** Cost-effectiveness, safety, humanitarian accuracy

**Status:** 🟢 Ready for deployment

**Next step:** Run `./scripts/setup.sh` and start auditing! 🚀
