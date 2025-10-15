"""
Main Training Script for Humanitarian LLM PoC
Handles data preparation, model training, and evaluation
"""

import json
import yaml
from pathlib import Path
from typing import Dict, Any
import sys


class HumanitarianLLMTrainer:
    """Main trainer for humanitarian LLM proof of concept"""
    
    def __init__(self, config_path: str = "./config.yaml"):
        self.config_path = Path(config_path)
        self.config = self.load_config()
        self.project_root = Path(__file__).parent.parent
        self.cost_tracker = {
            "data_api_calls": 0.0,
            "training_compute": 0.0,
            "inference_api": 0.0,
            "total": 0.0
        }
    
    def load_config(self) -> Dict[str, Any]:
        """Load configuration"""
        with open(self.config_path) as f:
            return yaml.safe_load(f)
    
    def check_prerequisites(self) -> bool:
        """Check if all prerequisites are met"""
        print("🔍 Checking prerequisites...")
        
        checks = {
            "Config file": self.config_path.exists(),
            "Data directory": (self.project_root / "data").exists(),
            "Models directory": (self.project_root / "models").exists(),
        }
        
        all_passed = True
        for check, passed in checks.items():
            status = "✓" if passed else "✗"
            print(f"  {status} {check}")
            if not passed:
                all_passed = False
        
        return all_passed
    
    def prepare_training_data(self, use_api: bool = False) -> Path:
        """
        Prepare complete training dataset
        
        Steps:
        1. Load base humanitarian dataset
        2. Generate synthetic data (optionally with API)
        3. Merge and format for training
        4. Split train/val/test
        """
        print("\n" + "="*60)
        print("DATA PREPARATION")
        print("="*60)
        
        from data_collection import HumanitarianDataCollector
        from synthetic_data import SyntheticDataGenerator
        
        data_dir = self.project_root / "data"
        
        # Step 1: Check if base dataset exists, create if not
        base_dataset_path = data_dir / "processed" / "humanitarian_base_dataset.json"
        if not base_dataset_path.exists():
            print("\n📦 Creating base dataset...")
            collector = HumanitarianDataCollector(str(data_dir))
            collector.create_initial_dataset()
        else:
            print(f"\n✓ Base dataset found: {base_dataset_path}")
        
        # Load base data
        with open(base_dataset_path) as f:
            base_data = json.load(f)
        print(f"  Loaded {len(base_data)} base samples")
        
        # Step 2: Generate/load synthetic data
        synthetic_dataset_path = data_dir / "synthetic" / "synthetic_dataset.json"
        
        if not synthetic_dataset_path.exists():
            print("\n🤖 Generating synthetic data...")
            generator = SyntheticDataGenerator(str(data_dir))
            generator.create_full_synthetic_dataset(
                num_samples=self.config['data']['target_samples'] - len(base_data),
                use_api=use_api
            )
        else:
            print(f"\n✓ Synthetic dataset found: {synthetic_dataset_path}")
        
        with open(synthetic_dataset_path) as f:
            synthetic_data = json.load(f)
        
        # Convert synthetic data to training format
        synthetic_formatted = []
        system_prompt = """You are a humanitarian expert AI assistant specialized in crisis response, humanitarian standards, and emergency operations."""
        
        for item in synthetic_data:
            if item.get('answer'):  # Only include items with answers
                synthetic_formatted.append({
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": item['question']},
                        {"role": "assistant", "content": item['answer']}
                    ],
                    "category": item.get('category', 'general')
                })
        
        print(f"  Loaded {len(synthetic_formatted)} synthetic samples (with answers)")
        
        # Step 3: Merge datasets
        combined_data = base_data + synthetic_formatted
        print(f"\n✓ Combined dataset: {len(combined_data)} total samples")
        
        # Step 4: Train/val/test split
        from sklearn.model_selection import train_test_split
        
        train_size = self.config['data']['train_size']
        val_size = self.config['data']['val_size']
        test_size = self.config['data']['test_size']
        
        # First split: train + val vs test
        train_val, test = train_test_split(
            combined_data,
            test_size=test_size,
            random_state=42
        )
        
        # Second split: train vs val
        val_ratio = val_size / (train_size + val_size)
        train, val = train_test_split(
            train_val,
            test_size=val_ratio,
            random_state=42
        )
        
        # Save splits
        processed_dir = data_dir / "processed"
        
        splits = {
            "train": train,
            "val": val,
            "test": test
        }
        
        for split_name, split_data in splits.items():
            split_path = processed_dir / f"{split_name}_dataset.json"
            with open(split_path, 'w') as f:
                json.dump(split_data, f, indent=2, ensure_ascii=False)
            print(f"  ✓ {split_name}: {len(split_data)} samples → {split_path}")
        
        # Save metadata
        metadata = {
            "total_samples": len(combined_data),
            "train_samples": len(train),
            "val_samples": len(val),
            "test_samples": len(test),
            "base_samples": len(base_data),
            "synthetic_samples": len(synthetic_formatted),
            "categories": list(set(item.get('category', 'general') for item in combined_data))
        }
        
        metadata_path = processed_dir / "training_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"\n✅ Training data ready!")
        print(f"   Metadata: {metadata_path}")
        
        return processed_dir / "train_dataset.json"
    
    def setup_training_environment(self):
        """
        Setup instructions for training environment
        Since we can't actually train in this environment, provide instructions
        """
        print("\n" + "="*60)
        print("TRAINING SETUP INSTRUCTIONS")
        print("="*60)
        
        print("""
Next steps to train your model:

1. CHOOSE YOUR TRAINING PLATFORM (pick one):
   
   Option A: Google Colab Pro ($12/month)
   - Best for: Quick start, no setup
   - Navigate to: colab.research.google.com
   - Upload your data folder
   
   Option B: Vast.ai / RunPod (pay-per-use)
   - Best for: Cost control, better GPUs
   - Cost: ~$0.30-0.60/hour
   - Estimated training time: 5-10 hours
   
   Option C: Local (if you have GPU)
   - Best for: Complete control, no ongoing costs
   - Requires: NVIDIA GPU with 8GB+ VRAM

2. INSTALL DEPENDENCIES:
   ```bash
   pip install -r requirements.txt
   ```

3. TRAINING SCRIPT:
   We'll generate a ready-to-run training script for you.
   It will use LoRA fine-tuning for efficiency.

4. ESTIMATED COSTS:
   - Data generation (API): $5-15 (if using API for synthetic data)
   - Training compute: $3-6 (5-10 hours on vast.ai)
   - Testing/inference: $5-10
   - Total: $13-31 (well under your $200 budget!)

5. MODEL CHOICE:
   Using: {model}
   This is a good balance of capability and cost.
   Quantized to 4-bit to reduce memory needs.
        """.format(model=self.config['model']['base_model']))
        
        return True
    
    def generate_training_script(self):
        """Generate the actual training script to run on GPU"""
        print("\n📝 Generating training script...")
        
        training_script = '''"""
Fine-tuning Script for Humanitarian LLM
Run this on a GPU-enabled environment (Colab, vast.ai, local)
"""

import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from datasets import load_dataset
import json

print("🚀 Starting Humanitarian LLM Training")
print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")

# Configuration
MODEL_NAME = "meta-llama/Llama-3.2-3B-Instruct"
OUTPUT_DIR = "./models/humanitarian-llm-poc"
DATA_PATH = "./data/processed/train_dataset.json"

# Load model with 4-bit quantization
print("\\n📦 Loading model...")
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    load_in_4bit=True,
    device_map="auto",
    trust_remote_code=True
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
tokenizer.pad_token = tokenizer.eos_token

# Prepare for LoRA
model = prepare_model_for_kbit_training(model)

# LoRA configuration
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# Load and prepare dataset
print("\\n📊 Loading dataset...")

def format_for_training(example):
    """Format chat messages for training"""
    messages = example["messages"]
    text = tokenizer.apply_chat_template(messages, tokenize=False)
    return {"text": text}

dataset = load_dataset("json", data_files={
    "train": "./data/processed/train_dataset.json",
    "validation": "./data/processed/val_dataset.json"
})

train_dataset = dataset["train"].map(format_for_training)
eval_dataset = dataset["validation"].map(format_for_training)

# Tokenize
def tokenize(examples):
    return tokenizer(
        examples["text"],
        truncation=True,
        max_length=2048,
        padding="max_length"
    )

train_dataset = train_dataset.map(tokenize, batched=True, remove_columns=["messages", "category", "text"])
eval_dataset = eval_dataset.map(tokenize, batched=True, remove_columns=["messages", "category", "text"])

# Training arguments
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    fp16=True,
    logging_steps=10,
    save_steps=500,
    eval_steps=100,
    evaluation_strategy="steps",
    save_total_limit=3,
    warmup_steps=100,
    report_to="none"
)

# Trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False)
)

# Train!
print("\\n🏋️ Starting training...")
print("This will take 5-10 hours depending on your GPU")
trainer.train()

# Save
print("\\n💾 Saving model...")
model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)

print("\\n✅ Training complete!")
print(f"Model saved to: {OUTPUT_DIR}")
'''
        
        script_path = self.project_root / "train_model.py"
        with open(script_path, 'w') as f:
            f.write(training_script)
        
        print(f"✓ Training script saved to: {script_path}")
        
        # Also create a Colab-ready notebook
        self.generate_colab_notebook()
        
        return script_path
    
    def generate_colab_notebook(self):
        """Generate a Colab notebook for easy training"""
        print("📓 Generating Colab notebook...")
        
        notebook = {
            "cells": [
                {
                    "cell_type": "markdown",
                    "metadata": {},
                    "source": ["# Humanitarian LLM Training - Colab Edition\n", 
                              "Upload your `data` folder to Colab, then run these cells."]
                },
                {
                    "cell_type": "code",
                    "metadata": {},
                    "source": [
                        "# Install dependencies\n",
                        "!pip install -q transformers peft accelerate bitsandbytes datasets"
                    ]
                },
                {
                    "cell_type": "code",
                    "metadata": {},
                    "source": [
                        "# Upload data\n",
                        "from google.colab import files\n",
                        "# Upload your train/val json files here"
                    ]
                },
                {
                    "cell_type": "code",
                    "metadata": {},
                    "source": ["# Run training script\n", "!python train_model.py"]
                }
            ],
            "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}},
            "nbformat": 4,
            "nbformat_minor": 4
        }
        
        notebook_path = self.project_root / "humanitarian_llm_training.ipynb"
        with open(notebook_path, 'w') as f:
            json.dump(notebook, f, indent=2)
        
        print(f"✓ Colab notebook saved to: {notebook_path}")
    
    def print_summary(self):
        """Print final summary and next steps"""
        print("\n" + "="*60)
        print("🎉 PROOF OF CONCEPT FOUNDATION READY!")
        print("="*60)
        
        print("""
✅ WHAT YOU HAVE NOW:

1. Project Structure
   └── humanitarian-llm-poc/
       ├── data/               (base + synthetic datasets)
       ├── models/             (for trained models)
       ├── audits/             (PETRI audit results)
       ├── src/                (training & audit code)
       ├── config.yaml         (configuration)
       └── train_model.py      (ready-to-run training)

2. Data Pipeline
   ✓ Base humanitarian dataset (10 expert Q&A pairs)
   ✓ Synthetic data generator (200+ questions)
   ✓ Training/validation/test splits
   ✓ Formatted for instruction tuning

3. PETRI Auditing Framework
   ✓ Safety test scenarios
   ✓ Bias detection tests
   ✓ Cultural sensitivity checks
   ✓ Automated evaluation pipeline

4. Training Infrastructure
   ✓ LoRA fine-tuning configuration
   ✓ 4-bit quantization for efficiency
   ✓ Cost-optimized settings
   ✓ Ready-to-run scripts

📋 NEXT STEPS:

1. ENHANCE YOUR DATASET (Optional but recommended):
   - Add your "Hazard mapping triggers.xlsx" data
   - Generate more synthetic data with API (if budget allows)
   - Target: 500-2000 samples for best results

2. CHOOSE TRAINING PLATFORM:
   - Google Colab Pro: Easiest, $12/month
   - Vast.ai/RunPod: Most cost-effective, ~$3-6 total
   - Local: Free if you have GPU

3. RUN TRAINING:
   ```bash
   # Upload data folder to your chosen platform
   # Then run:
   python train_model.py
   ```
   Expected time: 5-10 hours
   Expected cost: $3-10

4. AUDIT YOUR MODEL:
   ```python
   from src.petri_auditing import HumanitarianAuditor
   auditor = HumanitarianAuditor()
   results = auditor.run_audit(your_model)
   ```

5. BUILD DEMO (Optional):
   - Create Gradio interface
   - Deploy on Hugging Face Spaces (free tier)

💰 BUDGET TRACKING:
   Estimated total cost: $15-50
   Well under your $200 maximum!

📚 REFERENCES:
   - PETRI: https://www.anthropic.com/research/petri-open-source-auditing
   - Paper: https://arxiv.org/abs/2510.04618
   - Humanitarian Standards: https://spherestandards.org

🎯 SUCCESS CRITERIA FOR POC:
   ✓ Model responds accurately to humanitarian queries
   ✓ Passes >70% of PETRI safety tests
   ✓ Shows improvement over baseline
   ✓ Total cost under $200
   ✓ Demonstrates feasibility for full implementation

Need help with any step? Ask away!
        """)


def main():
    """Main execution flow"""
    trainer = HumanitarianLLMTrainer()
    
    # Check prerequisites
    if not trainer.check_prerequisites():
        print("\n⚠️  Prerequisites check failed")
        return
    
    # Prepare data
    train_data_path = trainer.prepare_training_data(use_api=False)
    
    # Setup training
    trainer.setup_training_environment()
    
    # Generate scripts
    trainer.generate_training_script()
    
    # Final summary
    trainer.print_summary()


if __name__ == "__main__":
    main()
