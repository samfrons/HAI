> **ARCHIVED — invalid results.** This describes the fine-tuning prototype
> the project abandoned. Its reported accuracy is not a real measurement.
> See the [postmortem](../README.md); the current system is documented in the
> [root README](../../README.md).

# 🌍 Humanitarian Expert LLM - Proof of Concept

A specialized Large Language Model for humanitarian crisis response, built using:
- [PETRI Open-Source Auditing](https://www.anthropic.com/research/petri-open-source-auditing) for safety
- [arXiv:2510.04618](https://arxiv.org/abs/2510.04618) methodology for domain specialization
- Humanitarian standards: Sphere, Core Humanitarian Standard, Protection Principles

**Budget**: Under $200 (target: $15-50)

## 🎯 Project Goals

Create a proof-of-concept LLM that:
1. Provides accurate humanitarian guidance based on international standards
2. Passes safety audits (PETRI framework) for bias, harm avoidance, cultural sensitivity
3. Demonstrates cost-effective fine-tuning approach
4. Serves as foundation for full humanitarian AI assistant

## 📁 Project Structure

```
humanitarian-llm-poc/
├── data/
│   ├── raw/                      # Original datasets
│   ├── processed/                # Training datasets
│   │   ├── humanitarian_base_dataset.json
│   │   ├── train_dataset.json
│   │   ├── val_dataset.json
│   │   └── test_dataset.json
│   └── synthetic/                # Generated data
│       └── synthetic_dataset.json
├── src/
│   ├── data_collection.py        # Base dataset creation
│   ├── synthetic_data.py         # Synthetic data generation
│   ├── petri_auditing.py         # PETRI safety auditing
│   └── train_orchestrator.py    # Main training pipeline
├── models/                        # Trained models (after training)
├── audits/                        # Audit reports
├── config.yaml                    # Configuration
├── requirements.txt               # Dependencies
├── train_model.py                 # Training script (run on GPU)
├── demo_app.py                    # Gradio demo interface
└── README.md                      # This file
```

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Clone or download project
cd humanitarian-llm-poc

# Install dependencies (if using GPU environment)
pip install -r requirements.txt
```

### 2. Generate Training Data

```bash
# Generate base humanitarian dataset (free, already done!)
python src/data_collection.py

# Generate synthetic questions (free)
python src/synthetic_data.py

# Optional: Enhance with Claude API (costs ~$5-15)
export ANTHROPIC_API_KEY='your-key-here'
python src/synthetic_data.py
```

**Current Status**: ✅ 93 enhanced samples ready (79 train, 9 val, 5 test) - ENHANCED WITH HAI KNOWLEDGE BASE!

### 3. Choose Training Platform

| Platform | Cost | Setup | Best For |
|----------|------|-------|----------|
| **Google Colab Pro** | $12/month | Easy | Quick start, no local GPU |
| **Vast.ai / RunPod** | $3-10 total | Medium | Cost control, flexible |
| **Local GPU** | Free | Complex | Full control, requires 8GB+ VRAM |

### 4. Train the Model

#### Option A: Google Colab
1. Upload `humanitarian_llm_training.ipynb` to Colab
2. Upload `data` folder
3. Run all cells
4. Download trained model

#### Option B: Vast.ai / RunPod
1. Rent GPU instance (~$0.40/hour)
2. Upload project folder
3. Run: `python train_model.py`
4. Expected time: 5-10 hours
5. Download model from `./models/`

#### Option C: Local
```bash
# Requires CUDA-capable GPU
python train_model.py
```

### 5. Test with PETRI Auditing

```python
from src.petri_auditing import HumanitarianAuditor

# Load your trained model
def your_model_fn(prompt):
    # Your model inference code
    return response

# Run audit
auditor = HumanitarianAuditor()
results = auditor.run_audit(your_model_fn)
auditor.save_audit_report(results)
```

### 6. Launch Demo

```bash
python demo_app.py --model-path ./models/humanitarian-llm-poc
```

Access at: http://localhost:7860

## 📊 Dataset Details

### Base Dataset (10 samples)
Expert-curated Q&A pairs covering:
- Sphere Standards (water, shelter, food, sanitation)
- Protection principles
- Humanitarian coordination
- Emergency response
- Cultural sensitivity

### Synthetic Dataset (200 questions)
Generated covering:
- Water and sanitation in camps
- Food distribution in conflict
- Emergency shelter
- Healthcare delivery
- Child protection
- Gender-based violence prevention
- Cash programming
- Logistics and supply chain

### Enhancement Options
1. **Add your data**: Include domain-specific datasets (e.g., hazard mapping triggers)
2. **API enhancement**: Use Claude Haiku to generate answers (~$5-15 for 200 samples)
3. **Web scraping**: Collect from humanitarian websites (free but time-intensive)

Target: 500-2000 total samples for optimal results

## 🔍 PETRI Auditing Framework

Tests across 6 critical dimensions:

1. **Factual Accuracy**: Correct humanitarian standards
2. **Cultural Sensitivity**: Respectful, contextual responses
3. **Harm Avoidance**: Safeguarding, protection principles
4. **Bias Detection**: Impartial, need-based approach
5. **Misinformation Resistance**: Rejects false claims
6. **Protection Principles**: Do No Harm compliance

**Success Criteria**: >70% pass rate across all categories

### Run Baseline Audit

```bash
python src/petri_auditing.py
```

View results in `audits/baseline_audit.csv`

## 💰 Budget Breakdown

### Estimated Costs

| Item | Cost Range | Notes |
|------|------------|-------|
| Data generation (API) | $0-15 | Optional, can use free methods |
| Training compute | $3-10 | Vast.ai/RunPod for 5-10 hours |
| Testing/inference | $5-10 | API calls for evaluation |
| Infrastructure | $0-12 | Colab Pro (optional) |
| **Total** | **$8-47** | Well under $200 budget! |

### Cost Optimization Tips

1. **Use smaller model**: Llama-3.2-3B instead of 7B/8B
2. **Quantization**: 4-bit reduces memory by 75%
3. **LoRA fine-tuning**: Only train 1-2% of parameters
4. **Batch API enhancement**: Process multiple questions per call
5. **Free tier first**: Start with Colab free, upgrade if needed

## 🏗️ Technical Details

### Model Configuration
- **Base**: meta-llama/Llama-3.2-3B-Instruct
- **Method**: LoRA (Low-Rank Adaptation)
- **Quantization**: 4-bit (bitsandbytes)
- **Context**: 2048 tokens
- **Training**: 3 epochs, ~5-10 hours

### LoRA Settings
```yaml
r: 16
lora_alpha: 32
lora_dropout: 0.05
target_modules: [q_proj, v_proj, k_proj, o_proj]
```

### Hardware Requirements
- **Training**: 12-16GB VRAM (or 8GB with gradient checkpointing)
- **Inference**: 4-8GB VRAM (or CPU with quantization)

## 📈 Evaluation Metrics

### Quantitative
- PETRI audit pass rate (target: >70%)
- Category-specific scores
- Perplexity on test set
- Response quality ratings

### Qualitative
- Humanitarian expert review
- Real-world scenario testing
- Cultural appropriateness assessment
- Safeguarding compliance check

## 🎓 Next Steps

### Immediate (PoC Phase)
- [x] Setup project structure
- [x] Create base humanitarian dataset
- [x] Implement PETRI auditing
- [x] Generate synthetic data
- [ ] Add hazard mapping data
- [ ] Run training (5-10 hours)
- [ ] Complete PETRI audit
- [ ] Create demo deployment

### Future Enhancements
- [ ] Expand dataset to 2000+ samples
- [ ] Multi-language support
- [ ] Real-time fact-checking
- [ ] Integration with humanitarian databases
- [ ] Mobile deployment
- [ ] Continuous learning pipeline

## 📚 Resources

### Humanitarian Standards
- [Sphere Standards](https://spherestandards.org) - Technical standards
- [Core Humanitarian Standard](https://corehumanitarianstandard.org) - Quality & accountability
- [IASC Protection Policy](https://interagencystandingcommittee.org) - Protection principles

### AI Safety
- [PETRI Framework](https://www.anthropic.com/research/petri-open-source-auditing)
- [arXiv Paper 2510.04618](https://arxiv.org/abs/2510.04618)

### Training Resources
- [Hugging Face Transformers](https://huggingface.co/docs/transformers)
- [PEFT Documentation](https://huggingface.co/docs/peft)
- [Google Colab](https://colab.research.google.com)

## 🤝 Contributing

### Adding Domain Data
1. Format as Q&A pairs in JSON
2. Follow humanitarian standards
3. Include category tags
4. Submit via pull request

### Improving Audits
1. Add test scenarios to `petri_auditing.py`
2. Cover edge cases
3. Include cultural contexts
4. Test thoroughly

## ⚠️ Disclaimer

This is a proof-of-concept AI system. **Always**:
- Verify AI responses with humanitarian professionals
- Consult official standards and guidelines
- Consider local context and cultural factors
- Prioritize safety and do no harm
- Seek expert guidance for operational decisions

AI should augment, not replace, human humanitarian expertise.

## 📧 Support

For questions or issues:
1. Check `audits/` folder for model performance
2. Review training logs in `models/`
3. Test with demo app first
4. Consult humanitarian standards documentation

## 📄 License

This project is for humanitarian purposes. Please ensure any use aligns with humanitarian principles and applicable laws.

---

## 🚀 READY TO TRAIN! Quick Start Guide

### ✅ What's Ready:
- 93 humanitarian training samples (enhanced with HAI knowledge base)
- Training/validation/test split complete (79/9/5)
- Configuration optimized for budget training
- Google Colab notebook prepared

### 📋 Next Steps (10 minutes to start training):

1. **Open Google Colab**
   - Go to [colab.research.google.com](https://colab.research.google.com)
   - Upload `HAI_Training_Colab.ipynb` (in this directory)

2. **Enable GPU**
   - Runtime → Change runtime type → T4 GPU

3. **Upload Files**
   - Run Cell 2 and upload these 5 files:
     - `train_dataset.json`
     - `val_dataset.json`
     - `test_dataset.json`
     - `config.yaml`
     - `train.py`

4. **Run Training**
   - Runtime → Run all (or run cells sequentially)
   - Wait 15-30 minutes for training to complete

5. **Download Model**
   - Run Cell 7 to download `humanitarian-model.tar.gz`

### 📊 Expected Results:
- Training time: 15-30 minutes on T4 GPU
- Cost: $0 (free tier) or $12/month (Colab Pro)
- Model size: ~500MB (LoRA adapter)
- Ready for Petri auditing!

### 📚 Additional Guides:
- `TRAINING_PLATFORM_SETUP.md` - Detailed platform comparison
- `HAI_Training_Colab.ipynb` - Ready-to-use Colab notebook
- `../hai/INTEGRATION_GUIDE.md` - Complete HAI + HAI-CD workflow

---

**Status**: ✅ DATA READY - READY TO TRAIN!
**Next Action**: Open `HAI_Training_Colab.ipynb` in Google Colab
**Budget Used**: $0 (all preparation done locally)
**Budget Remaining**: Full $200 for training (but will only need $0-12!)

Built with ❤️ for humanitarian response
