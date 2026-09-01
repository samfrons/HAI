# Invalid audit output — kept as a cautionary record

The two JSON files in this directory are **not evidence of model quality.**

`audit_report_20251015_084624.json` reports "26/26 scenarios passed, 100%,
$0.00" and `cost_report_20251015_084624.json` is its cost companion. That
result is invalid: the auditor routed every generation call — including the
judge's — to the same local model that was being graded, so the number is a
model marking its own homework. The grading prompt also handed the judge the
expected JSON shape and the passing bar.

The full explanation is in
[`research/docs/WARNING_INVALID_AUDIT.md`](../../research/docs/WARNING_INVALID_AUDIT.md),
and the postmortem covering this and two related bugs is in
[`research/README.md`](../../research/README.md).

These files are kept deliberately rather than deleted: the project's own
strategy document cites this "100% pass" as the cautionary example of why an
eval whose judge shares a failure mode with the system under test is not an
eval. The current evaluation path is the harness in
[`evals/`](../../evals/README.md), which publishes its failure rates.

The scenario set these were run against — `petri/seeds/humanitarian_test_scenarios.json`
— is *not* discredited. The scenario design was never the problem; the
auditor that ran them was, and those 26 scenarios are reused as-is today.
