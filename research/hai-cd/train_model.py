"""
Fine-tuning Script for Humanitarian LLM (QLoRA)

Trains a Qwen3-8B model with 4-bit NF4 quantization and LoRA adapters
on humanitarian Q&A data. Run on a GPU-enabled environment.

Environment variables (all optional, sensible defaults below):
  HAI_MODEL         Base model (default: Qwen/Qwen3-8B)
  HAI_OUTPUT        Output directory
  HAI_TRAIN_DATA    Training dataset path
  HAI_VAL_DATA      Validation dataset path
"""

import json
import os
import sys
from pathlib import Path

import torch
from datasets import load_dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)

SEED = 42

MODEL_NAME = os.environ.get("HAI_MODEL", "Qwen/Qwen3-8B")
OUTPUT_DIR = os.environ.get("HAI_OUTPUT", "./models/humanitarian-llm-poc")
TRAIN_PATH = os.environ.get("HAI_TRAIN_DATA", "./data/processed/train_dataset.json")
VAL_PATH = os.environ.get("HAI_VAL_DATA", "./data/processed/val_dataset.json")

print(f"Model:      {MODEL_NAME}")
print(f"Output:     {OUTPUT_DIR}")
print(f"Train data: {TRAIN_PATH}")
print(f"Val data:   {VAL_PATH}")
print(f"PyTorch:    {torch.__version__}")
print(f"CUDA:       {torch.cuda.is_available()}")

# --- Validate data files ---------------------------------------------------

for label, path in [("Training", TRAIN_PATH), ("Validation", VAL_PATH)]:
    if not Path(path).exists():
        print(f"ERROR: {label} data not found at {path}")
        sys.exit(1)
    with open(path) as f:
        try:
            rows = json.load(f)
        except json.JSONDecodeError:
            rows = [json.loads(line) for line in f if line.strip()]
    count = len(rows) if isinstance(rows, list) else 0
    print(f"{label}: {count} samples")
    if count < 100:
        print(f"WARNING: {label} dataset has only {count} samples — results may be unreliable")

# --- Quantization ----------------------------------------------------------

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
)

print(f"\nLoading {MODEL_NAME} with NF4 quantization...")
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token

model = prepare_model_for_kbit_training(model)
model.gradient_checkpointing_enable()

# --- LoRA ------------------------------------------------------------------

lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# --- Dataset ---------------------------------------------------------------

print("\nLoading dataset...")

dataset = load_dataset("json", data_files={"train": TRAIN_PATH, "validation": VAL_PATH})


def format_for_training(example):
    text = tokenizer.apply_chat_template(example["messages"], tokenize=False)
    return {"text": text}


train_dataset = dataset["train"].map(format_for_training)
eval_dataset = dataset["validation"].map(format_for_training)


def tokenize(examples):
    return tokenizer(examples["text"], truncation=True, max_length=2048, padding="max_length")


drop_cols = [c for c in train_dataset.column_names if c != "text"]
train_dataset = train_dataset.map(tokenize, batched=True, remove_columns=drop_cols + ["text"])
eval_dataset = eval_dataset.map(tokenize, batched=True, remove_columns=[c for c in eval_dataset.column_names if c != "text"] + ["text"])

# --- Dynamic hyperparameters -----------------------------------------------

BATCH_SIZE = 4
GRAD_ACCUM = 4
EPOCHS = 3

effective_batch = BATCH_SIZE * GRAD_ACCUM
steps_per_epoch = max(1, len(dataset["train"]) // effective_batch)
total_steps = steps_per_epoch * EPOCHS

warmup_steps = max(1, int(total_steps * 0.10))
eval_steps = max(1, steps_per_epoch // 2)
save_steps = max(1, steps_per_epoch)
logging_steps = max(1, steps_per_epoch // 10)

print(f"\nDataset:  {len(dataset['train'])} train / {len(dataset['validation'])} val")
print(f"Steps:    {total_steps} total, {warmup_steps} warmup, eval every {eval_steps}")

# --- Training --------------------------------------------------------------

training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=EPOCHS,
    per_device_train_batch_size=BATCH_SIZE,
    gradient_accumulation_steps=GRAD_ACCUM,
    learning_rate=2e-4,
    bf16=True,
    logging_steps=logging_steps,
    save_steps=save_steps,
    eval_steps=eval_steps,
    evaluation_strategy="steps",
    save_total_limit=3,
    load_best_model_at_end=True,
    warmup_steps=warmup_steps,
    seed=SEED,
    report_to="none",
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
)

print("\nStarting training...")
trainer.train()

print("\nSaving model...")
model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)

metadata = {
    "base_model": MODEL_NAME,
    "output_dir": OUTPUT_DIR,
    "train_samples": len(dataset["train"]),
    "val_samples": len(dataset["validation"]),
    "epochs": EPOCHS,
    "batch_size": BATCH_SIZE,
    "grad_accum": GRAD_ACCUM,
    "warmup_steps": warmup_steps,
    "lora_r": lora_config.r,
    "lora_alpha": lora_config.lora_alpha,
    "quantization": "NF4 double-quant bfloat16",
    "seed": SEED,
}
with open(Path(OUTPUT_DIR) / "training_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print(f"\nTraining complete. Model saved to {OUTPUT_DIR}")
