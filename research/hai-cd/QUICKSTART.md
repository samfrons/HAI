> **ARCHIVED — invalid results.** These steps set up the abandoned
> fine-tuning prototype, not the current system. See the
> [postmortem](../README.md); to actually run HAI, use the
> [root README](../../README.md#quickstart).

# 🚀 Quick Start Guide - Humanitarian LLM PoC

## ✅ What's Already Done

You have a **complete foundation** ready to train:

```
✓ Project structure setup
✓ Base humanitarian dataset (10 expert Q&A)
✓ Synthetic data generator (200 questions)
✓ PETRI auditing framework
✓ Training configuration
✓ Training script (ready to run on GPU)
✓ Demo application
✓ Complete documentation
```

**Status**: Foundation complete ✅  
**Budget used**: <$5  
**Time spent**: ~1 hour

## 🎯 Your Next Steps (Choose Your Path)

### Path A: Quick Demo (5 minutes)
Try the demo with placeholder responses:
```bash
cd humanitarian-llm-poc
python demo_app.py
```
Open http://localhost:7860 to test the interface

### Path B: Add Your Hazard Data (30 minutes)
```bash
# 1. Copy your Excel file
cp "Hazard mapping triggers.xlsx" ./data/raw/

# 2. Process it
python src/hazard_processor.py

# 3. Review generated data
cat data/processed/hazard_dataset.json | head -50
```

### Path C: Enhance with API (1 hour, $5-15)
```bash
# 1. Set API key
export ANTHROPIC_API_KEY='your-key-here'

# 2. Generate high-quality answers
python src/synthetic_data.py

# This will enhance 200 questions with Claude Haiku
# Cost: ~$5-15 depending on batch size
```

### Path D: Train the Model (5-10 hours, $3-10)

#### Option 1: Google Colab (Easiest)
1. Go to https://colab.research.google.com
2. Upload `humanitarian_llm_training.ipynb`
3. Upload entire `data/` folder
4. Click Runtime → Run all
5. Wait 5-10 hours
6. Download trained model

#### Option 2: Vast.ai (Cheapest)
```bash
# 1. Sign up at vast.ai
# 2. Rent GPU ($0.30-0.60/hour)
# 3. Upload project folder
# 4. SSH into instance:
ssh -p PORT user@instance.vast.ai

# 5. Train
cd humanitarian-llm-poc
pip install -r requirements.txt
python train_model.py

# 6. Download model after ~5-10 hours
# Total cost: $3-6
```

#### Option 3: Local GPU
```bash
# If you have NVIDIA GPU with 8GB+ VRAM
pip install -r requirements.txt
python train_model.py
```

## 📊 What You'll Get

After training completes:

1. **Trained Model**: `./models/humanitarian-llm-poc/`
   - LoRA weights (~200MB)
   - Tokenizer config
   - Training metrics

2. **Ready to Test**:
   ```bash
   python demo_app.py --model-path ./models/humanitarian-llm-poc
   ```

3. **Run Audits**:
   ```python
   from src.petri_auditing import HumanitarianAuditor
   
   auditor = HumanitarianAuditor()
   results = auditor.run_audit(your_model)
   ```

4. **Deploy** (optional):
   - Hugging Face Spaces (free)
   - Modal Labs (free tier)
   - Your own server

## 💰 Budget Tracker

| Stage | Cost | Status |
|-------|------|--------|
| Setup | $0 | ✅ Complete |
| Base data | $0 | ✅ Complete |
| API enhancement | $0-15 | ⏳ Optional |
| Training | $3-10 | ⏳ Pending |
| Testing | $5-10 | ⏳ After training |
| **Total** | **$8-35** | ✅ Under budget |

**Remaining**: $165-192 of $200 budget

## 🎓 Learning Resources

While training runs:

1. **Humanitarian Standards**:
   - [Sphere Handbook](https://spherestandards.org/handbook/)
   - [Core Humanitarian Standard](https://corehumanitarianstandard.org/)
   
2. **AI Safety**:
   - [PETRI Paper](https://www.anthropic.com/research/petri-open-source-auditing)
   - [Training Guidelines](https://arxiv.org/abs/2510.04618)

3. **Technical**:
   - [LoRA Paper](https://arxiv.org/abs/2106.09685)
   - [PEFT Docs](https://huggingface.co/docs/peft)

## ⚡ Performance Tips

### Speed Up Training:
- Use smaller batch size if OOM: `per_device_train_batch_size=2`
- Enable gradient checkpointing: `gradient_checkpointing=True`
- Reduce max_length: `max_seq_length=1024`

### Improve Quality:
- Add more training data (target: 500-2000 samples)
- Train for more epochs: `num_epochs=5`
- Use larger model: `Llama-3.2-8B` (requires more VRAM)

### Reduce Costs:
- Use even smaller model: `Llama-3.2-1B`
- Train fewer epochs: `num_epochs=1`
- Use cheaper GPU on vast.ai

## 🔍 Troubleshooting

### Out of Memory
```python
# In train_model.py, reduce:
batch_size = 2  # from 4
gradient_accumulation_steps = 8  # from 4
```

### Training Too Slow
```python
# Use better GPU or reduce:
max_seq_length = 1024  # from 2048
```

### Poor Results
1. Add more training data
2. Train longer (5+ epochs)
3. Check data quality
4. Run PETRI audits to identify issues

## 📞 Getting Help

1. **Check logs**: Look in console output for errors
2. **Review audits**: Check `audits/` folder for issues
3. **Read README**: Full documentation in `README.md`
4. **Test incrementally**: Use demo app to test before full deployment

## 🎉 Success Checklist

- [ ] Foundation setup complete ✅
- [ ] Demo runs locally
- [ ] Hazard data added (optional)
- [ ] Data enhanced with API (optional)
- [ ] Model training started
- [ ] Training completed successfully
- [ ] PETRI audit passed (>70%)
- [ ] Demo with trained model works
- [ ] Documentation reviewed
- [ ] Under $200 budget ✅

## What's Next?

Once training completes:

1. **Immediate**:
   - Run PETRI audits
   - Test with real humanitarian scenarios
   - Share demo with colleagues

2. **Short-term** (1-2 weeks):
   - Collect feedback
   - Add more domain data
   - Fine-tune based on evaluation

3. **Long-term** (1-3 months):
   - Scale to production
   - Add multi-language support
   - Integrate with humanitarian systems
   - Continuous improvement pipeline

---

**Ready to start?** Pick your path above and let's build this! 🚀

**Questions?** Review `README.md` for detailed documentation.

**Stuck?** Check troubleshooting section or review audit outputs.
