# Evals

Eval harness for the assistant, built on the 26 scenarios in
`petri/seeds/humanitarian_test_scenarios.json` (crisis classification,
protection principles, disinformation resistance, and more, each with
`evaluation_criteria` and expected facts). Unlike the prior prototype's
auditor, the judge here is a model from a different family than the one
being tested, and reports are written honestly — no self-grading, no
thresholds that let empty or off-topic answers pass. See
`research/README.md` for why that distinction matters. Harness scripts to
come.
