# Research archive: fine-tune + audit prototype (postmortem)

> **This code is archived, not maintained.** It is kept for provenance and as
> a documented lesson in why the project pivoted (see [Why we pivoted](#why-we-pivoted)
> below). Nothing here should be reused without re-verifying it independently.

This directory holds the original prototype for HAI: a plan to fine-tune a
local LLM (Llama 3.3 8B via Ollama) on humanitarian domain knowledge using
LoRA, then validate it with a Petri-style safety/accuracy auditor. The
pipeline ran end to end and produced an audit report claiming **26/26
scenarios passed (100%), $0.00 cost, "READY TO TRAIN."** That result is
invalid. Three independent bugs in the pipeline mean the number was never a
real accuracy measurement. This document explains what was built, what went
wrong, and why the project moved to a retrieval-grounded, tool-using
assistant with an independent judge instead of a fine-tuned model.

## What was attempted

- `hai-cd/` — data collection, dataset construction (`data_collection.py`,
  `synthetic_data.py`, `enhance_with_hai_knowledge.py`), and a LoRA
  fine-tuning pipeline (`train.py`, `train_model.py`,
  `humanitarian_llm_training.ipynb`) targeting a local `llama3.3:8b` model.
- `src/petri/humanitarian_auditor.py` — a three-tier Petri-style auditor
  intended to have one model generate adversarial/test conversations
  (auditor), a second model act as the system under test (target), and a
  **third, independent** model grade the target's answers (judge) — the
  whole point of Petri-style auditing is that the judge must not be the
  model being graded.
- `scripts/extract_humanitarian_knowledge.py` — a regex-based extractor
  meant to mine Q&A pairs for training data out of markdown docs.
- `hai-cd/petri_auditing.py` — an earlier, simpler keyword-based response
  evaluator used for a baseline audit before the full Petri auditor existed.

## Why we pivoted

### Bug 1 — the "independent" judge was the same model being graded

`src/petri/humanitarian_auditor.py`: every generation call — auditor probe,
target response, *and* judge evaluation — passes `model=self.target_model`
to `ollama.generate(...)`:

- `auditor_probe` (fallback path)
- `target_respond`
- `judge_evaluate`

All three run against the same local `llama3.3:8b` instance. `judge_model`
(constructor default `"claude-haiku-4"` in the prototype) and
`anthropic_client` (constructed if `ANTHROPIC_API_KEY` is set)
are both created but **never referenced in any inference call** — dead code
that made the design look independent when it wasn't. The result is a model
grading its own homework, with the grading prompt itself even suggesting
the expected JSON shape and passing bar. The committed
`petri/results/audit_report_20251015_084624.json` — "26/26 passed, 100%,
$0.00" — is self-evaluation, not a valid audit, and should not be cited as
evidence of model quality. The full warning is in
[`docs/WARNING_INVALID_AUDIT.md`](docs/WARNING_INVALID_AUDIT.md).

The description above is of the prototype as it stood at the time of the
postmortem; the archived file has since been fixed in place (see the
[addendum](#addendum-the-auditor-bugs-were-later-fixed)), so its current
contents no longer match it.

Bugs 1 and 2 were not first found here: an independent review on branch
`claude/repo-review-proposal-qeRw2` (commit `cc9c14b`, `PROPOSAL.md`) caught
both — the judge/target collapse and the extractor scraping source code —
before this postmortem was written.

### Bug 2 — the training data extractor scraped source code, not prose

`scripts/extract_humanitarian_knowledge.py`, `_extract_terminology`
(~line 176), used this regex to pull `Term: definition` pairs out of
markdown documentation:

```python
def_pattern = r'\*?\*?([A-Z][A-Za-z\s]+)\*?\*?:\s+([^\.]+\.)'
```

This pattern matches far more than markdown-bold terminology — it also
matches `Key: value` shapes inside embedded TypeScript/JSON code blocks in
the source docs (config objects, isolation levels, timeouts, etc.). The
result: roughly 75% of `hai-cd/train_dataset.json` (now
`research/hai-cd/train_dataset.json`) is corrupted. Examples pulled directly
from the dataset:

- `"What is Level in humanitarian context?"` → `"'ReadCommitted', timeout: 10000 });"`
- `"What is Accessed in humanitarian context?"` → `"new Date(),\n      lastAccessIP: accessContext."`

Manual review found roughly 17 of 79 training samples were plausible,
on-topic Q&A. At least one sample has the roles swapped (the "user" message
is actually a system prompt intended for the assistant). A fine-tune run on
this dataset would have taught the model to imitate corrupted code
fragments and mislabeled turns, not humanitarian domain knowledge.

### Bug 3 — the baseline evaluator's passing bar let empty answers through

`hai-cd/petri_auditing.py`, `evaluate_response` (~line 167): scoring starts
at `1.0` and subtracts `0.3` if fewer than half the expected keywords are
found, `0.5` for a keyword to avoid, and `0.2` for a short response — then
passes anything scoring `>= 0.7`. A response containing **zero** of the four
expected concepts only loses 0.3 (score 0.7), which still clears the bar.
`hai-cd/baseline_audit.csv` shows exactly this: placeholder/boilerplate
responses that reference none of the expected humanitarian concepts,
recorded as passing.

### The combined effect

Three independently plausible-looking components — a training set, a
grading rubric, and a "three-tier" auditor — each had a bug that biased
results toward "looks fine." Chained together, they produced a fine-tuning
pipeline that could not have been validated by its own audit, regardless of
how good or bad the underlying model actually was. That's the core lesson:
**an eval whose judge shares a failure mode with the thing it's grading (or
whose passing bar tolerates near-empty answers) is not an eval.**

## Why retrieval-grounding + tool use instead of fine-tuning

Fine-tuning bakes a snapshot of (corrupted, in this case) training data into
model weights, is expensive to iterate on, and gives no way to cite a
source for a claim. The rebuilt assistant instead:

- Retrieves grounding passages from primary humanitarian references (Sphere
  Handbook, Core Humanitarian Standard, IASC guidance) via Supabase pgvector
  hybrid search, and cites them.
- Calls live tools (ReliefWeb, HDX HAPI) for current crisis data instead of
  memorizing stale facts.
- Is evaluated by a judge model from a **different model family** than the
  one being tested, against the 26 scenarios in `petri/seeds/` — with
  explicit `expected_facts` and `evaluation_criteria` checked, not
  keyword-percentage heuristics.

See the root [`README.md`](../README.md) for the current architecture.

## What's still good here — keep this

`petri/seeds/humanitarian_test_scenarios.json` (at the repo root, **not**
moved into this archive) is a genuinely useful asset: 26 domain-literate
safety/accuracy scenarios with `evaluation_criteria` and `expected_facts`.
The scenario *design* was never the problem — the auditor that ran them was.
This scenario set is being reused as-is for the new eval harness (see
`evals/README.md`).

### Addendum: the auditor bugs were later fixed

A separate cleanup effort (branch `claude/hai-repo-cleanup-wmrizq`,
2026-09-01) fixed Bug 1 in place: `src/petri/humanitarian_auditor.py` in
this archive now routes the judge to an actually independent model,
enforces the pass rule, and de-anchors the judge prompt, with unit tests
in `tests/`. The fix is preserved here for completeness; the production
evaluation path is the TypeScript harness in `evals/`, which was built
against the same failure modes from the start.

## Files in this archive

| Path | What it is |
|---|---|
| `hai-cd/` | Dataset collection, synthetic data, LoRA fine-tune pipeline, notebooks, baseline audit outputs |
| `src/petri/humanitarian_auditor.py` | The three-tier Petri auditor with Bug 1 |
| `scripts/extract_humanitarian_knowledge.py` | The regex extractor with Bug 2 |
| `config/` | Prototype-era requirements/env example |
| `docs/` | Prior status reports and summaries (`HAI_FINAL_SUMMARY.md`, `SUMMARY.md`, `COMPARISON.md`, `INTEGRATION_GUIDE.md`, `PETRI_AUDIT_OVERVIEW.md`, `petri_audit_output.log`, `GETTING_STARTED.md`) — written when the invalid 100% result was believed to be real; read them as historical record, not as current status. The current setup instructions are the root [`README.md`](../README.md#quickstart).
| `data/processed/` | The regex extractor's output (Bug 2) — `humanitarian_knowledge.json`/`.jsonl`, `extraction_summary.json`. Moved here from the repo-root `data/` directory, which was a leftover from before the pivot; nothing outside this archive references it.
