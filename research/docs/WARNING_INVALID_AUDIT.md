# WARNING: invalid audit report

`petri/results/audit_report_20251015_084624.json` (repo root, not moved —
`petri/` stays in place) reports "26/26 passed, 100%, $0.00." This is
**self-evaluation, not a valid audit**: the auditor, target, and judge
generation calls in `src/petri/humanitarian_auditor.py` all ran against the
same local model (`self.target_model`). The intended independent judge
(`judge_model` / `anthropic_client`) was never actually called.

Kept in place deliberately, as evidence for the postmortem below — do not
delete it, and do not cite its numbers as a real accuracy measurement.

See [`../README.md`](../README.md#bug-1--the-independent-judge-was-the-same-model-being-graded)
for the full explanation.
