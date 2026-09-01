# HAI (Humanitarian AI) - Getting Started Guide

## Quick Start (5 Minutes)

```bash
# 1. Navigate to HAI directory
cd hai

# 2. Run setup script (installs Ollama, Python deps, Petri)
./scripts/setup.sh

# 3. Activate Python environment
source venv/bin/activate

# 4. Configure API keys
cp config/.env.example config/.env
# Edit config/.env with your API keys

# 5. Start Ollama server (in separate terminal)
ollama serve

# 6. Generate initial ACE context
python3 src/ace/context_optimizer.py --domain crisis_response

# 7. Run humanitarian AI audit (10 scenarios for testing)
python3 src/petri/humanitarian_auditor.py --scenarios 10

# Done! Check petri/results/ for audit reports
```

## Detailed Setup

### Prerequisites

- macOS or Linux
- Python 3.10+
- 8GB+ RAM (16GB recommended for local fine-tuning)
- 10GB+ free disk space

### Step 1: Install Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Verify installation
ollama --version

# Pull Llama 3.3 8B model (~4.7GB)
ollama pull llama3.3:8b

# Start Ollama server (keep running in background)
ollama serve
```

### Step 2: Python Environment Setup

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Install dependencies
pip install -r config/requirements.txt

# Install Petri framework
pip install git+https://github.com/safety-research/petri.git
```

### Step 3: Configure API Keys

```bash
# Copy example config
cp config/.env.example config/.env

# Edit config/.env and add:
# - ANTHROPIC_API_KEY (for Claude Haiku/Sonnet)
# - OPENROUTER_API_KEY (optional, for free tier testing)
```

**Get API Keys:**
- Anthropic: https://console.anthropic.com/
- OpenRouter: https://openrouter.ai/ (free tier available)

### Step 4: Extract Humanitarian Knowledge

```bash
# Extract knowledge from CLEAR docs
python3 scripts/extract_humanitarian_knowledge.py \
  --docs-dir=../docs \
  --output-dir=data/processed

# This creates:
# - data/processed/humanitarian_knowledge.json (full knowledge base)
# - data/processed/humanitarian_knowledge.jsonl (training data)
# - data/processed/extraction_summary.json
```

**Extracted Knowledge:**
- 118 crisis types identified
- 333 humanitarian terminology entries
- 83 training Q&A pairs
- 34 verified statistics
- 317 platform mentions

## Core Workflows

### Workflow 1: Generate ACE-Optimized Context

The ACE (Agentic Context Engineering) framework creates evolving contexts that improve through reflection and curation.

```bash
# Generate initial humanitarian context
python3 src/ace/context_optimizer.py \
  --domain crisis_response \
  --iterations 5 \
  --model llama3.3:8b

# Output saved to:
# - ace/contexts/initial_context.json
# - ace/playbooks/humanitarian_playbook.json
```

**What it does:**
1. Extracts relevant humanitarian knowledge
2. Generates structured system prompt
3. Optimizes through iterative reflection (local model = FREE)

### Workflow 2: Run Petri Audit

Petri tests your humanitarian AI across 26 safety and accuracy scenarios.

```bash
# Run full audit (26 scenarios, ~$50-100 cost)
python3 src/petri/humanitarian_auditor.py \
  --budget 200 \
  --target llama3.3:8b

# Run limited audit for testing (10 scenarios, ~$20-40 cost)
python3 src/petri/humanitarian_auditor.py \
  --scenarios 10 \
  --budget 50

# Results saved to:
# - petri/results/audit_report_[timestamp].json
# - petri/results/cost_report_[timestamp].json
```

**Cost breakdown:**
- Auditor (OpenRouter free tier): $0
- Target (Ollama local): $0
- Judge (Claude Haiku): ~$1-4 per scenario
- Total for 26 scenarios: **$50-100**

### Workflow 3: Combined ACE + Petri Optimization

Use ACE to optimize context, then audit with Petri in an iterative loop.

```bash
# Coming soon: Integrated optimization script
python3 scripts/optimize_and_audit.py
```

This will:
1. Generate initial context with ACE
2. Run Petri audit
3. Use results to refine context
4. Repeat until target accuracy achieved

## Understanding the Test Scenarios

HAI includes **26 comprehensive test scenarios** covering:

### Accuracy Testing (11 scenarios)
- Multi-hazard crisis classification
- Early warning system statistics
- Platform integration knowledge
- Verified humanitarian data

**Example:**
```json
{
  "id": "early_warning_accuracy_001",
  "name": "Early Warning System Interpretation",
  "expected_facts": [
    "Multi-hazard early warning systems reduce mortality 8x",
    "$800M investment prevents $3-16B in losses",
    "24-hour warning reduces damage by 30%"
  ]
}
```

### Ethics Testing (5 scenarios)
- Resource allocation under scarcity
- Do No Harm principle application
- Accountability to affected populations

### Safety Alignment (4 scenarios)
- Deception resistance
- Sycophancy resistance
- Power-seeking resistance
- Self-preservation resistance

### Cultural & Conflict Sensitivity (2 scenarios)
- Culturally appropriate interventions
- Operating in active conflict zones

### Technical Knowledge (6 scenarios)
- HDX, KoboToolbox, FEWS NET, ACLED platforms
- System integration challenges
- Data fragmentation issues

## Cost Optimization Strategies

### Free Tier (80% of operations)

1. **Local Ollama** for:
   - Target model responses
   - ACE context generation
   - ACE reflection loops
   - **Cost: $0**

2. **OpenRouter Free Tier** for:
   - Petri auditor role
   - Additional testing
   - **Cost: $0**

### Paid Tier (20% of operations)

1. **Claude Haiku** for:
   - Petri judge evaluations
   - Critical validation only
   - **Cost: $0.25/$1.25 per M tokens**

2. **Claude Sonnet** for:
   - Final validation (optional)
   - Complex scenario analysis
   - **Cost: $3/$15 per M tokens**

### Budget Control

```python
# Set strict budget limits
auditor = HumanitarianAuditor(budget=50.0)

# Limit scenarios for testing
auditor.run_audit(max_scenarios=5)

# Check cost before running full audit
print(f"Estimated cost: ${estimated_cost:.2f}")
```

## Fine-Tuning (Optional - Week 2)

Coming soon: LoRA fine-tuning pipeline with Unsloth.

```bash
# Prepare training data
python3 scripts/prepare_training_data.py

# Fine-tune with LoRA (local, FREE)
python3 src/fine_tuning/train_lora.py \
  --base-model llama3.3:8b \
  --training-data data/training/humanitarian_qa.jsonl \
  --output-dir models/outputs/humanitarian-llama-v1

# Test fine-tuned model
python3 src/petri/humanitarian_auditor.py \
  --target models/outputs/humanitarian-llama-v1 \
  --scenarios 10
```

## Next Steps

### Immediate (Week 1)
1. ✅ Extract knowledge from CLEAR docs
2. ✅ Generate ACE-optimized context
3. ✅ Run initial Petri audit (10 scenarios)
4. ⏳ Analyze results and refine context

### Short-term (Week 2)
1. Fine-tune Llama 3.3 8B with LoRA
2. Run full Petri audit (26 scenarios)
3. Compare base vs. fine-tuned model
4. Generate comparative analysis report

### Medium-term (Week 3-4)
1. Implement ACE + Petri optimization loop
2. Test with premium models (Sonnet validation)
3. Expand test scenarios (50+ scenarios)
4. Create deployment guide

### Long-term (Post-POC)
1. Multi-language support
2. Regional humanitarian contexts
3. Integration with CLEAR production system
4. Field testing with humanitarian organizations

## Troubleshooting

### Ollama Connection Issues

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
pkill ollama
ollama serve
```

### Python Import Errors

```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r config/requirements.txt
```

### API Key Issues

```bash
# Verify .env file
cat config/.env | grep API_KEY

# Test Anthropic API
python3 -c "from anthropic import Anthropic; client = Anthropic(); print('✓ Connected')"
```

### Budget Exceeded

```bash
# Check current spend
python3 -c "from src.petri.humanitarian_auditor import CostTracker; t = CostTracker(); print(t.get_summary())"

# Reduce scenarios
python3 src/petri/humanitarian_auditor.py --scenarios 5 --budget 25
```

## Success Metrics

### Technical
- ✅ 10%+ improvement on humanitarian benchmarks
- ✅ Identify 3+ safety concerns in baseline models
- ✅ 8%+ performance gains from ACE optimization

### Cost
- ✅ Stay under $200 total budget
- ✅ Demonstrate $2-5 per 1000 queries production cost

### Quality
- ✅ 85%+ accuracy on humanitarian terminology
- ✅ Pass all ethical allocation tests
- ✅ Validate against CLEAR fact-checked data

## Support

- **Documentation**: Check `docs/` directory
- **Issues**: Create GitHub issue (if applicable)
- **CLEAR System**: See main CLEAR documentation
- **Petri Framework**: https://github.com/safety-research/petri
- **ACE Paper**: https://arxiv.org/abs/2510.04618

---

**Budget Tracker:** 📊
- Phase 1 (Setup): $0
- Phase 2 (Initial Audit): $20-50
- Phase 3 (Full Audit): $50-100
- Phase 4 (Validation): $50-100
- **Total**: ~$100-200

**Ready to build ethical, accurate humanitarian AI! 🚀**
