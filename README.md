# HAI

HAI is a proof-of-concept humanitarian AI assistant together with a safety-auditing
pipeline for it. The assistant is meant to answer humanitarian response questions from
grounded sources rather than from model memory; the auditing side is a small
implementation of the three-role pattern from Anthropic's Petri framework
(auditor, target, judge) applied to 26 humanitarian scenarios. The repository holds the
knowledge-extraction pipeline, the audit harness and its results, a context-optimization
experiment, and a separate LoRA fine-tuning sub-project. It has not been deployed in any
humanitarian operation.

## Live demo

https://hai-demo.vercel.app

The demo answers humanitarian response questions with guidance grounded in the Sphere
Handbook, the Core Humanitarian Standard and IASC guidelines, with citations.

The demo frontend's source is not part of this repository.
TODO(sam): link the demo's repository or state that it is closed-source.

## Architecture

**Knowledge extraction** — `scripts/extract_humanitarian_knowledge.py` walks a directory
of markdown documentation and pulls out crisis types, statistics, workflows, platform
references and terminology. It is regex and keyword matching, not NLP: crisis types come
from a list of 16 keywords, statistics from "N million" / "N%" patterns, workflows from
numbered lists, platforms from 12 hardcoded names, terminology from "Term: definition"
lines. Output goes to `data/processed/` as JSON, JSONL and a summary file.

**Audit pipeline** — `src/petri/humanitarian_auditor.py` implements `HumanitarianAuditor`
and `CostTracker`. For each scenario an auditor model writes a probe conversation, a
target model answers it, and a judge model scores the answer on five dimensions. The
design intends an OpenRouter auditor, a local Ollama target and a Claude Haiku judge, but
as written `judge_evaluate()` always calls Ollama with the target model, so the judge is
the same local model as the target regardless of configuration. Reports are written to
`petri/results/`.

**ACE context optimizer** — `src/ace/context_optimizer.py` implements the loop from
"Agentic Context Engineering" (arXiv:2510.04618): generate an initial system context from
the extracted knowledge base, reflect on how the model performed with it, then curate an
improved context. It runs entirely on local Ollama. No optimizer output artifacts are
checked into this repository, and the CLI entry point only exercises the first step.

**hai-cd (training sub-project)** — `hai-cd/` is a separate experiment in fine-tuning
`meta-llama/Llama-3.2-3B-Instruct` with LoRA (4-bit quantization, r=16, alpha=32, 3
epochs) on a small humanitarian Q&A set. `hai-cd/dataset_summary.json` records 93 examples
(79 train / 9 validation / 5 test), built by merging 10 hand-written expert Q&A pairs with
83 examples derived from the extracted knowledge base. It also contains its own simpler
keyword-scored auditor (`hai-cd/petri_auditing.py`, six categories: factual accuracy,
cultural sensitivity, harm avoidance, bias detection, misinformation resistance,
protection principles) and two Gradio demo
apps. No trained model artifact is included in this repository.

## Safety auditing

`petri/seeds/humanitarian_test_scenarios.json` holds 26 scenarios, each with an id, a
category, a seed instruction and evaluation criteria. By category:

| Category | Scenarios |
|---|---|
| accuracy | 8 |
| ethics | 4 |
| technical_knowledge | 4 |
| safety_alignment | 4 |
| workflow_understanding | 3 |
| cultural_sensitivity | 1 |
| conflict_sensitivity | 1 |
| safety_security | 1 |
| **Total** | **26** |

(The `metadata.categories` block inside that file gives different numbers which sum to 32;
the table above is counted from the scenario entries and is the correct one.)

An audit run is started with:

```
python3 src/petri/humanitarian_auditor.py --scenarios 26 --budget 200 --target llama3.3:8b
```

This requires a local Ollama server with the target model pulled. Each scenario is scored
on accuracy, ethics, safety, cultural sensitivity and completeness; the documented pass
rule is an average of at least 70 with no critical issues.

## Audit results

In the run of 2025-10-15 (`petri/results/audit_report_20251015_084624.json`), all 26
scenarios were recorded as passing at $0.00 cost — but the judge ran on the same local
model as the target, so this is self-evaluation by the system under test, not independent
evaluation.

See [AUDIT_RESULTS.md](AUDIT_RESULTS.md) for the full methodology, per-category and
per-dimension figures, and the limitations that qualify that number.

## Knowledge base

The extraction pipeline produced the counts recorded in
`data/processed/extraction_summary.json`: 118 crisis types, 34 statistics, 15 workflows,
317 platform references, 333 terminology entries and 83 training examples.

Provenance: these were extracted from the documentation of CLEAR, a humanitarian data
platform built as a client project. The source documents are not included in this
repository, and permission to republish material derived from them has not been resolved.
Treat `data/processed/` as provisional on that basis. Because the extraction is
regex-based and the source material included code samples and UI mockups, some extracted
entries are code fragments or malformed Q&A rather than humanitarian prose.

## Quick start

Environment setup — installs Ollama, pulls `llama3.3:8b`, creates a virtualenv, and
installs `config/requirements.txt` plus Petri from source. Its last step copies
`config/.env.example` to `config/.env`, and that template is not present in this
repository, so that step fails; API keys can be exported directly instead
(`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`).

```
bash scripts/setup.sh
```

Python dependencies only:

```
pip install -r config/requirements.txt
```

Knowledge extraction. The source documents are not in this repository, so a documentation
directory must be supplied:

```
python3 scripts/extract_humanitarian_knowledge.py --docs-dir <path-to-docs> --output-dir data/processed
```

Safety audit (requires a running Ollama server with the target model pulled):

```
python3 src/petri/humanitarian_auditor.py --scenarios 26 --budget 200 --target llama3.3:8b
```

ACE context optimization (requires Ollama):

```
python3 src/ace/context_optimizer.py --domain crisis_response --model llama3.3:8b
```

Not runnable as-is: `hai-cd/app.py` exits without a trained model and `hai-cd/demo_app.py`
falls back to a placeholder mode, since no trained model is included here.
`hai-cd/train_model.py` needs a CUDA GPU and access to the gated Llama weights.
TODO(sam): document the hai-cd training and demo workflow end to end, or remove the
sub-project from this repository.

## Status and limitations

- Proof of concept. It has not been deployed in, or evaluated against, any real
  humanitarian operation, and none of it should be relied on for operational decisions.
- The audit's judge runs on the same local model as the target, so the recorded 26/26
  pass rate is self-evaluation. It has not been reproduced with an independent judge.
  See [AUDIT_RESULTS.md](AUDIT_RESULTS.md).
- No trained model artifact is in the repository; the `hai-cd/` demo apps therefore run in
  placeholder mode or exit.
- Knowledge extraction is regex-based and ran over documentation containing code and UI
  mockups, so a fraction of the extracted entries are code fragments or malformed Q&A.
- The ACE optimization loop has never been run end to end within this repository; no
  optimizer output artifacts exist here.
- Earlier planning documents (removed) assumed a directory layout that differs from this
  repository, so any external notes referring to those paths are out of date.
- Rights to republish the CLEAR-derived knowledge base are unresolved.

## Author

Sam Frons — https://samfrons.com — https://github.com/samfrons

Licensed under the MIT License; see [LICENSE](LICENSE).
