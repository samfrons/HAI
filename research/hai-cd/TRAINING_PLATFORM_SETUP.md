# HAI-CD Training Platform Setup Guide

## Platform Comparison

### ✅ RECOMMENDED: Google Colab Free/Pro
**Cost**: Free tier available, Pro $12/month
**Best for**: Quick start, beginners, testing
**Setup time**: 5 minutes
**GPU**: T4 (free) or A100/V100 (Pro)

**Pros**:
- Pre-installed ML packages
- Zero setup complexity
- Notebook interface (easy debugging)
- Can start free, upgrade if needed

**Cons**:
- Session timeouts (need to monitor)
- Limited to 12-24 hours per session

### 💰 BUDGET OPTION: Vast.ai
**Cost**: $3-10 total for this training
**Best for**: One-time training, cost optimization
**Setup time**: 15 minutes
**GPU**: RTX 3090/4090 (your choice)

**Pros**:
- Pay only for actual training time
- Cheaper than Colab Pro for one-off tasks
- More powerful GPU options
- No session limits

**Cons**:
- Requires SSH and Docker knowledge
- More complex setup
- Need to monitor billing

### ❌ NOT RECOMMENDED: Local macOS
**Cost**: Free
**Issues**:
- Python 3.13 compatibility problems
- Limited GPU (M-series not optimized for training)
- Longer training time
- Risk of system conflicts

---

## Quick Start: Google Colab (RECOMMENDED)

### Step 1: Prepare Files for Upload
All files ready in `hai-cd/` directory:
- ✅ `train_dataset.json` (79 samples)
- ✅ `val_dataset.json` (9 samples)
- ✅ `test_dataset.json` (5 samples)
- ✅ `config.yaml` (training config)
- ✅ `train.py` (training script)
- ✅ `app.py` (Gradio demo)

### Step 2: Create Google Colab Notebook
1. Go to [colab.research.google.com](https://colab.research.google.com)
2. Create new notebook
3. Enable GPU: Runtime → Change runtime type → T4 GPU

### Step 3: Upload and Run
```python
# Cell 1: Upload files
from google.colab import files
import os

# Create working directory
!mkdir -p /content/hai-cd
%cd /content/hai-cd

# Upload all files (drag & drop in Colab UI)
# Files needed: train_dataset.json, val_dataset.json, test_dataset.json, config.yaml, train.py, app.py

# Cell 2: Install dependencies
!pip install transformers torch peft accelerate datasets pyyaml tqdm
!pip install gradio anthropic openai sentence-transformers

# Cell 3: Verify data
import json
with open('train_dataset.json', 'r') as f:
    data = json.load(f)
print(f"Training samples: {len(data)}")

# Cell 4: Start training
!python train.py

# Cell 5: Test the model
!python app.py
```

### Step 4: Download Trained Model
```python
# After training completes
from google.colab import files
import shutil

# Create archive of model
!tar -czf humanitarian-model.tar.gz ./humanitarian-model/
files.download('humanitarian-model.tar.gz')
```

**Expected training time**: 15-30 minutes on T4
**Expected cost**: Free (or $12/month for Pro)

---

## Alternative: Vast.ai Setup

### Step 1: Create Vast.ai Account
1. Go to [vast.ai](https://vast.ai)
2. Sign up and add $10 credit
3. Search for instances: "RTX 3090" or "RTX 4090"
4. Filter: pytorch/pytorch template, >= 24GB RAM

### Step 2: Launch Instance
```bash
# SSH into your instance (provided by Vast.ai)
ssh -p [PORT] root@[IP]

# Clone your files or upload via SCP
# scp -P [PORT] -r hai-cd/ root@[IP]:/workspace/
```

### Step 3: Install and Train
```bash
cd /workspace/hai-cd
pip install -r requirements.txt
python train.py
```

### Step 4: Download Model
```bash
# On your local machine
scp -P [PORT] -r root@[IP]:/workspace/hai-cd/humanitarian-model/ ./
```

**Expected training time**: 10-20 minutes
**Expected cost**: $3-10 total

---

## Training Outputs

After training completes, you'll have:
- `humanitarian-model/` - LoRA adapter weights
- `training_metrics.json` - Loss curves and performance
- Model ready for Gradio demo app

---

## Next Steps

1. **Choose platform**: Colab Free (recommended to start)
2. **Upload files**: Use the prepared `hai-cd/` directory
3. **Run training**: Follow the notebook cells above
4. **Test model**: Run `app.py` to launch Gradio demo
5. **If needed**: Upgrade to Colab Pro or switch to Vast.ai

---

## Troubleshooting

**"Out of memory" error**:
- Reduce batch_size in config.yaml (try 2 instead of 4)
- Use smaller model variant
- Upgrade to better GPU (Colab Pro or Vast.ai)

**Session timeout**:
- Save checkpoints regularly (already configured)
- Use Colab Pro for longer sessions
- Switch to Vast.ai for uninterrupted training

**Slow training**:
- Verify GPU is enabled (check with `!nvidia-smi`)
- Reduce max_seq_length in config.yaml
- Use fewer training epochs (2 instead of 3)
