"""
HAI Model Training Script - Optimized for Google Colab
Fine-tunes Llama 3.2 3B on humanitarian knowledge using LoRA
"""

import os
import json
import yaml
import torch
from datetime import datetime
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from datasets import Dataset
import time

print("="*60)
print("🌍 Humanitarian AI (HAI) Model Training")
print("="*60)

# Load configuration
print("\n📋 Loading configuration...")
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

# Print setup info
print(f"\n🔧 Setup Information:")
print(f"   PyTorch version: {torch.__version__}")
print(f"   CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"   GPU: {torch.cuda.get_device_name(0)}")
    print(f"   GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
else:
    print("   ⚠️  WARNING: No GPU detected. Training will be very slow!")

# Configuration
MODEL_NAME = config['model']['base_model']
OUTPUT_DIR = "./humanitarian-model"
MAX_SEQ_LENGTH = config['model']['max_seq_length']

print(f"\n📊 Training Configuration:")
print(f"   Base model: {MODEL_NAME}")
print(f"   Max sequence length: {MAX_SEQ_LENGTH}")
print(f"   Quantization: {config['model']['quantization']}")
print(f"   Epochs: {config['training']['num_epochs']}")
print(f"   Batch size: {config['training']['batch_size']}")
print(f"   Learning rate: {config['training']['learning_rate']}")

# Load datasets
print("\n📁 Loading training datasets...")
with open('train_dataset.json', 'r') as f:
    train_data = json.load(f)
with open('val_dataset.json', 'r') as f:
    val_data = json.load(f)

print(f"   Training samples: {len(train_data)}")
print(f"   Validation samples: {len(val_data)}")

# Prepare datasets for training
def format_chat(example):
    """Convert chat format to training text"""
    messages = example['messages']
    text = ""
    for msg in messages:
        role = msg['role']
        content = msg['content']
        if role == 'system':
            text += f"System: {content}\n"
        elif role == 'user':
            text += f"User: {content}\n"
        elif role == 'assistant':
            text += f"Assistant: {content}\n"
    return {'text': text}

print("\n🔄 Preparing datasets...")
train_dataset = Dataset.from_list(train_data)
val_dataset = Dataset.from_list(val_data)

train_dataset = train_dataset.map(format_chat)
val_dataset = val_dataset.map(format_chat)

# Load model with 4-bit quantization
print("\n📦 Loading model with 4-bit quantization...")
quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4"
)

model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    quantization_config=quantization_config,
    device_map="auto",
    trust_remote_code=True
)

print("✅ Model loaded successfully")

# Load tokenizer
print("\n📝 Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
print("✅ Tokenizer loaded")

# Tokenize datasets
def tokenize_function(examples):
    return tokenizer(
        examples['text'],
        truncation=True,
        max_length=MAX_SEQ_LENGTH,
        padding='max_length'
    )

print("\n🔤 Tokenizing datasets...")
train_dataset = train_dataset.map(tokenize_function, batched=True, remove_columns=['text', 'messages'])
val_dataset = val_dataset.map(tokenize_function, batched=True, remove_columns=['text', 'messages'])
print("✅ Tokenization complete")

# Prepare model for LoRA
print("\n🔧 Preparing model for LoRA training...")
model = prepare_model_for_kbit_training(model)

# LoRA configuration
lora_config = LoraConfig(
    r=config['lora']['r'],
    lora_alpha=config['lora']['alpha'],
    target_modules=config['lora']['target_modules'],
    lora_dropout=config['lora']['dropout'],
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)
print("✅ LoRA configuration applied")

# Print trainable parameters
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
total_params = sum(p.numel() for p in model.parameters())
print(f"\n📊 Model Parameters:")
print(f"   Trainable: {trainable_params:,} ({100 * trainable_params / total_params:.2f}%)")
print(f"   Total: {total_params:,}")

# Training arguments
print("\n⚙️  Setting up training arguments...")
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=config['training']['num_epochs'],
    per_device_train_batch_size=config['training']['batch_size'],
    per_device_eval_batch_size=config['training']['batch_size'],
    learning_rate=float(config['training']['learning_rate']),
    warmup_steps=config['training']['warmup_steps'],
    logging_steps=10,
    eval_strategy="epoch",
    save_strategy="epoch",
    save_total_limit=2,
    load_best_model_at_end=True,
    report_to="none",
    fp16=torch.cuda.is_available(),
    gradient_checkpointing=config['training']['gradient_checkpointing']
)

# Create trainer
print("\n👨‍🏫 Creating trainer...")
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
)

# Start training
print("\n" + "="*60)
print("🚀 STARTING TRAINING")
print("="*60)
print(f"\nStart time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("\n💡 This will take approximately 15-30 minutes on T4 GPU")
print("📊 Progress will be shown below:\n")

start_time = time.time()

try:
    train_result = trainer.train()

    elapsed_time = time.time() - start_time

    print("\n" + "="*60)
    print("✅ TRAINING COMPLETED SUCCESSFULLY!")
    print("="*60)
    print(f"\n⏱️  Training time: {elapsed_time/60:.1f} minutes")
    print(f"📉 Final training loss: {train_result.training_loss:.4f}")

    # Save model
    print("\n💾 Saving model...")
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"✅ Model saved to: {OUTPUT_DIR}/")

    # Save training metrics
    metrics = {
        'training_loss': float(train_result.training_loss),
        'training_time_minutes': elapsed_time / 60,
        'epochs': config['training']['num_epochs'],
        'train_samples': len(train_data),
        'val_samples': len(val_data),
        'model_name': MODEL_NAME,
        'timestamp': datetime.now().isoformat(),
        'trainable_params': trainable_params,
        'total_params': total_params,
        'trainable_percentage': 100 * trainable_params / total_params
    }

    # Add evaluation metrics if available
    eval_results = trainer.evaluate()
    metrics['eval_loss'] = float(eval_results['eval_loss'])

    with open('training_metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)

    print(f"📊 Training metrics saved to: training_metrics.json")
    print(f"\n📈 Evaluation Results:")
    print(f"   Validation loss: {metrics['eval_loss']:.4f}")

    # Final summary
    print("\n" + "="*60)
    print("🎉 MODEL TRAINING COMPLETE!")
    print("="*60)
    print(f"\n✅ Model ready at: {OUTPUT_DIR}/")
    print(f"✅ Metrics saved to: training_metrics.json")
    print(f"\n📝 Next steps:")
    print(f"   1. Download the model (Cell 7 in Colab)")
    print(f"   2. Test with Gradio demo (Cell 8)")
    print(f"   3. Run Petri auditing (see ../hai/ directory)")
    print("\n🌍 Your humanitarian AI model is ready to help! 🎉\n")

except Exception as e:
    print("\n" + "="*60)
    print("❌ TRAINING FAILED")
    print("="*60)
    print(f"\nError: {str(e)}")
    print("\n🔧 Troubleshooting:")
    print("   1. Check GPU is enabled (Runtime → Change runtime type)")
    print("   2. Try reducing batch_size in config.yaml to 2")
    print("   3. Enable gradient_checkpointing in config.yaml")
    print("   4. Check CUDA memory with: !nvidia-smi")
    raise
