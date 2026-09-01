# hai-cd

A LoRA fine-tuning experiment for a humanitarian-domain chat model, built on
`meta-llama/Llama-3.2-3B-Instruct`.

## Training setup

- Base model: `meta-llama/Llama-3.2-3B-Instruct`
- Method: LoRA (r=16, alpha=32, dropout=0.05, target modules q/k/v/o_proj)
- Quantization: 4-bit
- Epochs: 3, batch size 4, learning rate 2e-4, max sequence length 2048
- Dataset: 93 examples (79 train / 9 val / 5 test) — 10 hand-written base
  Q&A pairs plus 83 examples sourced from CLEAR documentation
  (`dataset_summary.json` / `training_metadata.json` in this directory record
  the split and source counts)

Full config lives in `config.yaml`.

## Files

- `data_collection.py` — builds the 10-example base humanitarian dataset
- `enhance_with_hai_knowledge.py` — merges in the 83 CLEAR-derived examples
  from `humanitarian_knowledge.jsonl` (the script's hardcoded `../hai/` path
  assumes an older directory layout; in this repository the file lived at
  `../data/processed/`)
- `synthetic_data.py` — template-based question generator (uses the Claude
  API to fill in answers when a key is set); its output,
  `synthetic_dataset.json`, currently holds only unanswered question
  templates, not CLEAR content
- `hazard_processor.py` — converts a hazard-mapping Excel file into training
  examples; the input file is not included in this repo, so this script has
  not been run against real data
- `train.py` — Colab-oriented training script driven by `config.yaml`
- `train_model.py` — standalone LoRA training script (needs a CUDA GPU and
  access to the gated Llama 3.2 weights)
- `train_orchestrator.py` — pipeline wrapper around data prep / training /
  cost tracking
- `app.py` — Gradio demo that loads a trained LoRA adapter and runs inference
- `demo_app.py` — Gradio demo with keyword-based placeholder answers, used
  when no trained model is available
- `petri_auditing.py` — a keyword-scored auditor checking model responses
  across six categories (factual accuracy, cultural sensitivity, harm
  avoidance, bias detection, misinformation resistance, protection
  principles)
- `HAI_Training_Colab.ipynb`, `humanitarian_llm_training.ipynb` — notebooks
  for running training on Colab
- `config.yaml` — model, training, and auditing configuration
- `requirements.txt` — Python dependencies

## Status

No trained model artifact exists in this repository.

- `app.py` expects a `./humanitarian-model` directory and exits if it isn't
  there.
- `demo_app.py` runs without a model and falls back to a handful of
  hardcoded placeholder answers.
- `train_model.py` and `train.py` require a CUDA-capable GPU and gated
  access to the Llama 3.2 weights on Hugging Face; neither has been run to
  completion here.
- `hazard_processor.py` expects an Excel file of hazard-mapping data that is
  not part of this repository, so it has not been exercised on real input.

This directory should be treated as an unfinished proof-of-concept: the data
pipeline and training/demo scripts are written, but no evaluation or trained
weights back them up.
