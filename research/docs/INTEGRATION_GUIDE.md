# HAI + HAI-CD Integration Guide

## The Best of Both Worlds 🚀

This guide combines:
- **hai-cd**: Training pipeline, demo interface, quick deployment
- **hai**: Comprehensive auditing, ACE optimization, safety testing

**Result**: Production-ready humanitarian AI with world-class safety testing

**Total Cost**: $58-145 (vs $100-200 for hai alone, $8-45 for hai-cd alone)

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                   INTEGRATED HAI SYSTEM                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1: TRAINING (from hai-cd)                           │
│  ├── Llama 3.2 3B base model                               │
│  ├── LoRA fine-tuning                                      │
│  ├── Training data (210+ examples)                         │
│  └── Cost: $8-45                                           │
│                                                             │
│  Phase 2: AUDITING (from hai)                              │
│  ├── Petri comprehensive testing (26 scenarios)            │
│  ├── ACE context optimization                              │
│  ├── Claude Haiku judge                                    │
│  └── Cost: $50-100                                         │
│                                                             │
│  Phase 3: DEPLOYMENT (from hai-cd)                         │
│  ├── Gradio demo interface                                 │
│  ├── Optimized model                                       │
│  └── Production-ready                                      │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## Quick Start: Integrated Workflow

### Prerequisites

```bash
# Ensure both projects exist
ls -la hai/
ls -la hai-cd/

# Install dependencies for both
cd hai && pip install -r config/requirements.txt
cd ../hai-cd && pip install -r requirements.txt
```

---

## Week 1: Train Your Model (hai-cd)

### Day 1: Setup & Data Preparation

```bash
cd hai-cd

# 1. Generate base humanitarian dataset
python src/data_collection.py

# Output: humanitarian_base_dataset.json (10 expert Q&A)

# 2. Generate synthetic questions
python src/synthetic_data.py

# Output: synthetic_dataset.json (200+ questions)

# 3. (Optional) Enhance with Claude API
export ANTHROPIC_API_KEY='your-key-here'
python src/synthetic_data.py --enhance

# Cost: $0-15 for API enhancement
```

### Day 2-3: Train the Model

**Option A: Google Colab (Easiest)**

```bash
# 1. Upload humanitarian_llm_training.ipynb to Colab
# 2. Upload data/ folder
# 3. Run all cells
# 4. Download trained model

# Cost: $12/month for Colab Pro
# Time: 5-10 hours
```

**Option B: Vast.ai/RunPod (Most Cost-Effective)**

```bash
# 1. Rent GPU ($0.40/hour)
# 2. Upload project
# 3. Run training

python train_model.py

# Cost: $3-10 total
# Time: 5-10 hours
```

**Output**: `hai-cd/models/humanitarian-llm-final/`

### Day 4: Test Basic Demo

```bash
cd hai-cd

# Run demo interface
python demo_app.py

# Opens at http://localhost:7860
# Test humanitarian Q&A functionality
```

**Checkpoint**: You now have a trained humanitarian LLM! 🎉

**Cost so far**: $8-45

---

## Week 2: Audit & Optimize (hai)

### Day 5: Setup HAI Framework

```bash
cd ../hai

# Run automated setup
./scripts/setup.sh

# This installs:
# - Ollama
# - Llama 3.3 8B
# - Python dependencies
# - Petri framework

# Activate environment
source venv/bin/activate

# Configure API keys
cp config/.env.example config/.env

# Edit config/.env:
# - ANTHROPIC_API_KEY (for Claude Haiku)
# - OPENROUTER_API_KEY (optional)
```

### Day 6: Extract Knowledge & Generate Context

```bash
cd hai

# 1. Extract humanitarian knowledge from CLEAR
python3 scripts/extract_humanitarian_knowledge.py \
  --docs-dir=../docs \
  --output-dir=data/processed

# Output:
# - humanitarian_knowledge.json (118 crisis types, 333 terms)
# - humanitarian_knowledge.jsonl (83 training examples)

# 2. Generate ACE-optimized context
python3 src/ace/context_optimizer.py \
  --domain crisis_response \
  --iterations 5

# Output: ace/playbooks/humanitarian_playbook.json

# Cost: $0 (all local)
```

### Day 7: Run Comprehensive Petri Audit

```bash
cd hai

# Run audit on your trained model from hai-cd
python3 src/petri/humanitarian_auditor.py \
  --target-model ../hai-cd/models/humanitarian-llm-final \
  --scenarios 26 \
  --budget 100

# This tests:
# - 11 accuracy scenarios
# - 5 ethics scenarios
# - 4 safety alignment scenarios
# - 6 technical knowledge scenarios
# - 2 cultural/conflict sensitivity scenarios

# Output:
# - petri/results/audit_report_[timestamp].json
# - petri/results/cost_report_[timestamp].json

# Cost: $50-100
# Time: 2-4 hours
```

### Day 8: Analyze Results & Iterate

```bash
# View audit results
cat petri/results/audit_report_*.json

# Key metrics:
# - Overall accuracy
# - Pass/fail by category
# - Critical issues identified
# - Recommendations

# If accuracy < 85%:
# 1. Review failed scenarios
# 2. Generate improved context with ACE
# 3. Re-run specific tests
```

**Checkpoint**: You now have comprehensive safety metrics! 📊

**Total cost**: $58-145

---

## Integration Scripts

### Script 1: Unified Training & Auditing

Create `hai/scripts/train_and_audit.sh`:

```bash
#!/bin/bash
#
# Complete training + auditing pipeline
#

set -e

echo "======================================"
echo "HAI Integrated Workflow"
echo "======================================"

# Phase 1: Training (hai-cd)
echo -e "\n[Phase 1] Training model with hai-cd...\n"
cd ../hai-cd
python train_model.py

# Phase 2: Auditing (hai)
echo -e "\n[Phase 2] Auditing with hai Petri framework...\n"
cd ../hai
source venv/bin/activate

python3 src/petri/humanitarian_auditor.py \
  --target ../hai-cd/models/humanitarian-llm-final \
  --scenarios 26 \
  --budget 100

# Phase 3: Results
echo -e "\n[Phase 3] Audit complete!\n"
cat petri/results/audit_report_*.json | grep "accuracy"

echo -e "\nIntegrated workflow complete!"
```

### Script 2: Deploy Audited Model

Create `hai/scripts/deploy_audited_model.sh`:

```bash
#!/bin/bash
#
# Deploy audited model with optimized context
#

set -e

# 1. Get ACE-optimized context
CONTEXT=$(cat hai/ace/playbooks/humanitarian_playbook.json | jq -r '.context')

# 2. Update hai-cd demo with optimized context
cd hai-cd

# 3. Run demo with audited model
python demo_app.py \
  --model ./models/humanitarian-llm-final \
  --context "$CONTEXT"

echo "Demo running at http://localhost:7860"
```

---

## Cost Breakdown: Integrated System

| Phase | Component | Cost |
|-------|-----------|------|
| **Week 1: Training** | | |
| | Data generation (local) | $0 |
| | API enhancement (optional) | $0-15 |
| | GPU training (Vast.ai) | $3-10 |
| | Demo testing | $0 |
| | **Subtotal** | **$3-25** |
| **Week 2: Auditing** | | |
| | Knowledge extraction (local) | $0 |
| | ACE optimization (local) | $0 |
| | Petri auditing (26 tests) | $50-100 |
| | Iteration & refinement | $5-20 |
| | **Subtotal** | **$55-120** |
| **TOTAL** | | **$58-145** ✅ |

**Budget remaining**: $55-142 (from $200 budget)

---

## Feature Comparison: Integrated vs Standalone

| Feature | hai-cd alone | hai alone | **INTEGRATED** |
|---------|--------------|-----------|----------------|
| Training Pipeline | ✅ | ❌ | ✅ |
| Trained Model | ✅ | ❌ | ✅ |
| Basic PETRI (6 tests) | ✅ | ❌ | ✅ |
| Advanced PETRI (26 tests) | ❌ | ✅ | ✅ |
| ACE Optimization | ❌ | ✅ | ✅ |
| Knowledge Base (CLEAR) | ❌ | ✅ | ✅ |
| Demo Interface | ✅ | ❌ | ✅ |
| Cost Tracking | ❌ | ✅ | ✅ |
| Cost | $8-45 | $100-200 | $58-145 |
| Safety Testing | Basic | Comprehensive | **Comprehensive** |
| Production Ready | Partial | ❌ | **✅** |

---

## Advanced Integration

### Use HAI's Knowledge in HAI-CD Training

```bash
# 1. Export HAI knowledge base
cd hai
python3 << EOF
import json

# Load HAI knowledge
with open('data/processed/humanitarian_knowledge.json') as f:
    hai_data = json.load(f)

# Convert to hai-cd format
training_data = []
for item in hai_data.get('terminology', {}).items():
    training_data.append({
        'question': f"What is {item[0]} in humanitarian context?",
        'answer': item[1]
    })

# Save for hai-cd
with open('../hai-cd/data/processed/hai_knowledge_enhanced.json', 'w') as f:
    json.dump(training_data, f, indent=2)

print(f"Exported {len(training_data)} examples to hai-cd")
EOF

# 2. Retrain hai-cd model with enhanced data
cd ../hai-cd
python train_model.py --data data/processed/hai_knowledge_enhanced.json
```

### Use HAI-CD Model in HAI Testing

```python
# hai/src/petri/humanitarian_auditor.py
# Modify to use hai-cd model

auditor = HumanitarianAuditor(
    target_model="../hai-cd/models/humanitarian-llm-final",  # Use trained model
    auditor_model="meta-llama/llama-4-scout",
    judge_model="claude-haiku-4"
)

# Run audit
report = auditor.run_audit(max_scenarios=26)
```

---

## Success Metrics: Integrated System

### Technical Goals
- ✅ Trained model with 85%+ accuracy
- ✅ Passes 22/26 Petri scenarios (85%)
- ✅ ACE optimization shows +8% improvement
- ✅ No critical safety issues

### Cost Goals
- ✅ Stay under $150 total
- ✅ $3-10 per 1000 queries (production)

### Quality Goals
- ✅ Humanitarian terminology accuracy: 90%+
- ✅ Ethical decision-making: Pass all scenarios
- ✅ Cultural sensitivity: Pass all scenarios
- ✅ Fact accuracy: Based on CLEAR validated data

---

## Deployment: Production-Ready System

### Final Architecture

```
Production HAI System
├── Core Model (from hai-cd)
│   └── Llama 3.2 3B + LoRA fine-tuning
├── Context (from hai)
│   └── ACE-optimized humanitarian context
├── Safety Layer (from hai)
│   └── Petri-validated, 26 scenarios passed
└── Interface (from hai-cd)
    └── Gradio demo application
```

### Deploy Command

```bash
# 1. Build integrated deployment package
cd hai
./scripts/build_deployment.sh

# 2. Deploy
./scripts/deploy_production.sh

# Output:
# - Containerized app
# - Optimized model
# - Safety guardrails
# - Monitoring dashboard
```

---

## Troubleshooting

### Issue: hai-cd model not found

```bash
# Verify model path
ls -la hai-cd/models/

# If empty, retrain:
cd hai-cd
python train_model.py
```

### Issue: Petri audit fails

```bash
# Check API keys
cat hai/config/.env | grep ANTHROPIC_API_KEY

# Test connection
python3 -c "from anthropic import Anthropic; Anthropic().messages.create(model='claude-haiku-4', max_tokens=10, messages=[{'role':'user','content':'test'}])"
```

### Issue: Cost exceeding budget

```bash
# Reduce Petri scenarios
python3 src/petri/humanitarian_auditor.py --scenarios 10 --budget 25

# Use only free tier
python3 src/petri/humanitarian_auditor.py --judge-model "ollama/llama3.3:8b"
```

---

## Next Steps

### Week 3: Enhancement
1. Multi-language support
2. Regional context adaptation
3. CLEAR system integration
4. Field testing preparation

### Week 4: Production
1. API endpoint deployment
2. Monitoring & logging
3. User feedback collection
4. Continuous improvement loop

---

## Summary

**You now have:**
✅ Trained humanitarian LLM (hai-cd)
✅ Comprehensive safety testing (hai)
✅ ACE-optimized contexts (hai)
✅ Production-ready demo (hai-cd)
✅ Total cost: $58-145
✅ Best of both worlds!

**Next**: Start Week 1 training! 🚀
