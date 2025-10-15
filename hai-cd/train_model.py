"""
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
print("\n📦 Loading model...")
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
print("\n📊 Loading dataset...")

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
print("\n🏋️ Starting training...")
print("This will take 5-10 hours depending on your GPU")
trainer.train()

# Save
print("\n💾 Saving model...")
model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)

print("\n✅ Training complete!")
print(f"Model saved to: {OUTPUT_DIR}")
