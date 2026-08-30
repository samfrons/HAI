---
id: responsible-use
title: Responsible Use of AI in Humanitarian Work
skill_levels: [beginner, intermediate, advanced]
summary: Grounded in the IASC Operational Guidance on Data Responsibility — what never to input, how to verify, and when to escalate to a human.
---

# Responsible Use of AI in Humanitarian Work

This guide is grounded in the IASC's *Operational Guidance on Data Responsibility in Humanitarian Action* (Data Responsibility Working Group, April 2023), which sets out twelve principles humanitarian actors already work under: accountability, confidentiality, coordination and collaboration, data security, defined purpose/necessity/proportionality, fairness and legitimacy, human rights-based approach, people-centered and inclusive, personal data protection, quality, retention and destruction, and transparency — all underpinned by the overarching commitment to do no harm. Using AI doesn't create a new ethics framework. It creates a new place those same principles have to be applied.

## Never input beneficiary personal data — including near-misses

The clearest-cut rule: no personally identifiable information (PII) about an affected person goes into an AI prompt. Not a name, not a case number, not a combination of details that could re-identify someone even without a name attached.

The near-misses are where this actually goes wrong, because they don't feel like a violation in the moment:

- **"Can you summarize this case list for me?"** — pasting a spreadsheet of household names, ages, and needs to save time on a report. This is a personal data protection breach the moment it's pasted, regardless of what happens to the output.
- **"Help me write up this incident."** — describing a protection incident with the survivor's age, village, and the date, thinking the name is enough to omit. Age plus location plus date is frequently enough to identify someone in a small community.
- **"What's the best way to phrase this feedback from [name]?"** — a single beneficiary's quote, verbatim, dropped into a drafting prompt for a report. Even one identifiable quote is personal data.
- **"Translate this list of GBV survivor testimonies for the annex."** — arguably the highest-risk version of this mistake, combining sensitive personal data with a task (translation) people don't usually flag as a data-handling task at all.

The test that catches most of these: **if you wouldn't paste it into a public Slack channel, don't paste it into an AI chat.** Aggregate first, anonymize first, or don't use AI for that specific task.

## Verification is a duty, not a courtesy

Under the *quality* and *accountability* principles, the people relying on your output — colleagues, donors, affected communities — are trusting that what you tell them is accurate. AI-assisted output doesn't lower that bar; if anything it raises the verification workload, because a fluent, confident-sounding answer is easier to under-check than a rough draft you know needs work.

Concretely: every number gets checked against its source before it's used in anything that leaves your desk. Every standards citation gets checked against the actual handbook page. Every "the current guidance says" gets checked against the current guidance, because AI can retrieve an outdated or general version of something that's since been revised.

## Bias awareness in conflict contexts

Humanitarian information environments are contested by design — parties to a conflict have incentives to shape the narrative, and public data sources reflect whatever got reported, not necessarily what's most severe. An AI system summarizing that environment inherits its skew: if reporting from one area is thinner than another, a summary can understate need there without any signal that it's doing so.

Two working habits address this directly:

- Ask explicitly about coverage gaps: "What areas or population groups does this ReliefWeb data likely under-represent?"
- Treat a clean, confident-sounding summary of a contested situation with more suspicion, not less. Reality on the ground is rarely as tidy as a well-written paragraph.

## When to escalate to a human

Escalate — meaning, stop and get a person's judgment — whenever a task involves:

- A decision about an individual's eligibility, risk level, or safety.
- Content that will be published under your organization's name on a politically sensitive topic.
- Any donor compliance question where getting it wrong has financial consequences.
- A situation where AI flags its own uncertainty (a translation it's unsure about, an inference it's separated from a citation) — that flag is a signal to bring in a person, not to accept the best available guess.

AI producing a well-formatted, confident answer to a question it shouldn't be answering is a known failure mode. The way to catch it is a habit, not a filter: ask "is this a judgment call a trained person needs to make?" before you ask "did AI answer this well?"

## Environmental and cost awareness: local versus cloud models

Not every task needs the largest available cloud model. A local, on-device model draws far less power per query and keeps data from leaving your environment at all — which matters both for the retention and destruction principle and for contexts with limited or costly connectivity. As a rough guide: routine, low-stakes drafting and lookups are well suited to smaller or local models; tasks that need the most current live data, the deepest reasoning, or the widest context are where a larger cloud model earns its higher cost and footprint. Match the tool to the task rather than defaulting to the most powerful option out of habit.
