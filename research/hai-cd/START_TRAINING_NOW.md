> **ARCHIVED — invalid results, and this training run was never valid to
> start.** The dataset it points at is ~75% corrupted (see Bug 2 in the
> [postmortem](../README.md)); do not run these steps.

# 🚀 HAI Model Training - START NOW!

## ✅ SETUP COMPLETE - READY TO TRAIN!

All preparation work is done. You're ready to train your humanitarian AI model!

---

## 📊 What We've Prepared

### ✅ Enhanced Training Dataset
- **93 total samples** (up from 10 original)
- **79 training samples** (84.9%)
- **9 validation samples** (9.7%)
- **5 test samples** (5.4%)
- **Sources**: hai-cd base (10) + HAI knowledge base (83)
- **Format**: Chat format with messages array
- **Categories**: statistics, terminology, crisis_response, shelter, food_security

### ✅ Training Configuration
- **Base model**: meta-llama/Llama-3.2-3B-Instruct
- **Method**: LoRA fine-tuning (efficient, low-cost)
- **Quantization**: 4-bit (reduces memory by 75%)
- **Training**: 3 epochs, batch_size=4
- **Expected time**: 15-30 minutes on T4 GPU
- **Expected cost**: $0 (free tier) or $12/month (Colab Pro)

### ✅ Files Ready to Upload
All files are in `/hai-cd/` directory:
1. ✅ `train_dataset.json` (79 samples)
2. ✅ `val_dataset.json` (9 samples)
3. ✅ `test_dataset.json` (5 samples)
4. ✅ `config.yaml` (training config)
5. ✅ `train.py` (training script)
6. ✅ `app.py` (Gradio demo - optional)
7. ✅ `HAI_Training_Colab.ipynb` (ready-to-use notebook)

---

## 🎯 START TRAINING (3 Simple Steps)

### Step 1: Open Google Colab (2 minutes)

1. Go to [colab.research.google.com](https://colab.research.google.com)
2. Click **File** → **Upload notebook**
3. Upload `HAI_Training_Colab.ipynb` from this directory
4. Click **Runtime** → **Change runtime type** → Select **T4 GPU** → **Save**

### Step 2: Upload Training Files (3 minutes)

1. Run **Cell 1** (verify GPU)
2. Run **Cell 2** (file upload)
3. When prompted, upload these 5 files:
   - `train_dataset.json`
   - `val_dataset.json`
   - `test_dataset.json`
   - `config.yaml`
   - `train.py`

### Step 3: Train the Model (15-30 minutes)

1. Click **Runtime** → **Run all**
2. Wait for training to complete (monitor progress in outputs)
3. Download model when Cell 7 completes

**That's it! Your humanitarian AI model will be ready in ~30 minutes!**

---

## 📋 Detailed Workflow

### Cell-by-Cell Execution

| Cell | Task | Time | Action Required |
|------|------|------|-----------------|
| 1 | Verify GPU | 10s | None - auto-runs |
| 2 | Upload files | 1m | Click to upload 5 files |
| 3 | Install deps | 3-5m | None - auto-installs |
| 4 | Verify config | 10s | None - auto-verifies |
| 5 | **TRAIN MODEL** | **15-30m** | **None - wait for completion** |
| 6 | View results | 30s | None - shows metrics |
| 7 | Download model | 2m | Click to download |
| 8 | Test demo (optional) | 5m | Optional - launch Gradio |

### Training Progress Indicators

You'll see output like this during training:
```
Epoch 1/3: 100%|██████████| 20/20 [02:15<00:00,  6.77s/it]
Train Loss: 1.234
Val Loss: 1.156

Epoch 2/3: 100%|██████████| 20/20 [02:12<00:00,  6.62s/it]
Train Loss: 0.987
Val Loss: 0.945

Epoch 3/3: 100%|██████████| 20/20 [02:10<00:00,  6.53s/it]
Train Loss: 0.756
Val Loss: 0.812

✅ Training completed in 18.3 minutes!
```

---

## 💰 Cost Breakdown

### Option 1: Google Colab Free Tier (RECOMMENDED)
- **Cost**: $0
- **GPU**: T4 (16GB)
- **Time**: 25-35 minutes
- **Limitations**:
  - May disconnect after 90 minutes (training takes 15-30m, so no issue)
  - Limited daily usage hours
- **Best for**: Testing, proof of concept, budget-conscious

### Option 2: Google Colab Pro
- **Cost**: $12/month
- **GPU**: T4, V100, or A100
- **Time**: 10-20 minutes
- **Benefits**:
  - Faster GPUs available
  - Longer session times
  - Priority access
- **Best for**: Faster training, multiple iterations

### Option 3: Vast.ai (Alternative)
- **Cost**: $3-10 total
- **See**: `TRAINING_PLATFORM_SETUP.md` for details
- **Best for**: Cost optimization, one-time training

---

## 📊 Expected Training Results

After training completes, you'll have:

### 1. Trained Model
- **File**: `humanitarian-model.tar.gz` (~500MB)
- **Format**: LoRA adapter weights
- **Compatible with**: Llama 3.2 3B base model

### 2. Training Metrics
- **File**: `training_metrics.json`
- **Contains**:
  - Loss curves (training & validation)
  - Training time
  - Final model performance
  - Convergence statistics

### 3. Visualizations
- **File**: `training_curves.png`
- **Shows**: Loss reduction over epochs

### 4. Model Summary
- **File**: `dataset_summary.json`
- **Contains**: Dataset statistics and metadata

---

## 🧪 What to Do After Training

### 1. Test the Model (5 minutes)
Run Cell 8 in the Colab notebook to launch Gradio demo and test with:
- "What are the statistics on humanitarian funding?"
- "How should responders address natural disasters?"
- "What is GDPR compliance in humanitarian context?"

### 2. Run Petri Auditing (Next Phase)
```bash
# Extract model locally
tar -xzf humanitarian-model.tar.gz

# Navigate to HAI directory
cd ../hai

# Run comprehensive auditing
python run_audit.py --model-path ../hai-cd/humanitarian-model
```

This will test your model against 26 humanitarian safety scenarios!

### 3. Review Integration Guide
See `../hai/INTEGRATION_GUIDE.md` for the complete HAI + HAI-CD workflow.

---

## 🆘 Troubleshooting

### "Out of memory" error
**Solution**: Edit `config.yaml` and change:
```yaml
batch_size: 2  # reduce from 4 to 2
gradient_checkpointing: true  # add this line
```

### "No GPU available"
**Solution**:
1. Check Runtime → Change runtime type → T4 GPU is selected
2. If still no GPU: Wait a few minutes (free tier has queue)
3. Or upgrade to Colab Pro for guaranteed GPU access

### "Session disconnected"
**Solution**:
1. Training saves checkpoints every epoch
2. Re-run from Cell 5 to resume
3. Or use Colab Pro for more stable sessions

### "Training is very slow"
**Solution**:
1. Verify GPU is being used: Run `!nvidia-smi` in a cell
2. Check batch_size isn't too small (should be 4)
3. Consider upgrading to Colab Pro for faster GPU

### "Can't download model"
**Solution**:
1. Check your browser's download folder
2. Try right-click → Save As on download link
3. Or copy to Google Drive:
```python
from google.colab import drive
drive.mount('/content/drive')
!cp humanitarian-model.tar.gz /content/drive/MyDrive/
```

---

## 📚 Additional Resources

### In This Directory
- `README.md` - Project overview and details
- `TRAINING_PLATFORM_SETUP.md` - Platform comparison guide
- `HAI_Training_Colab.ipynb` - The training notebook (USE THIS!)
- `config.yaml` - Training configuration
- Dataset files (train/val/test)

### In Parent Directories
- `../hai/INTEGRATION_GUIDE.md` - Complete HAI + HAI-CD workflow
- `../hai/COMPARISON.md` - Feature comparison
- `../HAI_FINAL_SUMMARY.md` - Executive summary

### External Links
- [Google Colab](https://colab.research.google.com) - Training platform
- [Llama 3.2 Model Card](https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct)
- [LoRA Paper](https://arxiv.org/abs/2106.09685) - Fine-tuning method
- [Petri Framework](https://www.anthropic.com/research/petri-open-source-auditing) - Auditing

---

## ✨ Key Points

1. ✅ **All preparation is done** - just upload and train
2. ✅ **Free option available** - Google Colab free tier works great
3. ✅ **Quick training** - 15-30 minutes on T4 GPU
4. ✅ **Easy to use** - notebook has all cells pre-configured
5. ✅ **Ready for auditing** - Petri tests ready in `../hai/`

---

## 🎯 Your Action Items

- [ ] Open [colab.research.google.com](https://colab.research.google.com)
- [ ] Upload `HAI_Training_Colab.ipynb`
- [ ] Enable T4 GPU runtime
- [ ] Upload 5 training files (Cell 2)
- [ ] Run all cells
- [ ] Wait 15-30 minutes
- [ ] Download trained model
- [ ] Test with Gradio demo
- [ ] Run Petri auditing

**Time investment**: ~45 minutes total (30 minutes training, 15 minutes setup/testing)
**Cost**: $0 (free tier) or $12 (Colab Pro)

---

## 🚀 Ready? LET'S GO!

**👉 Next step: Open Google Colab and upload `HAI_Training_Colab.ipynb`**

Everything else is ready to go. The notebook will guide you through each step with clear instructions.

Good luck training your humanitarian AI model! 🌍❤️

---

**Questions?**
- Check `TRAINING_PLATFORM_SETUP.md` for platform details
- See `README.md` for project overview
- Review `../hai/INTEGRATION_GUIDE.md` for complete workflow

**Built with ❤️ for humanitarian response**
