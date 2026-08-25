---
id: meal-officer
title: MEAL Officer Playbook
role: MEAL Officer
icon: 📊
skill_levels: [beginner, intermediate, advanced]
summary: Using HAI for indicator design, survey question review, and qualitative coding assistance across Monitoring, Evaluation, Accountability and Learning work.
---

# MEAL Officer Playbook

MEAL work depends on getting the mechanics right — a question that isn't leading, an indicator that's actually measurable, a coding frame that holds up against real transcripts. AI is useful for the mechanical checks and the first-draft structure. It is not a substitute for the evidence itself, and it should never see raw respondent data.

## Where AI genuinely helps in this role

1. **Cross-checking draft indicators** against Sphere's key indicators for the relevant sector, flagging which are established and which are custom.
2. **Reviewing survey questions** for leading, double-barreled, or otherwise biased phrasing before piloting.
3. **Drafting a first-pass qualitative coding framework** from a research question, to be validated against real anonymized data before use.
4. **Grounding indicator targets in live baseline data** pulled from HDX HAPI rather than an assumed number.
5. **Drafting the structure of a learning brief or lessons-learned summary** from bullet-point inputs, before you fill in the actual findings.

## Where AI should NOT be used

- **Never to code actual qualitative transcripts or open-ended survey responses that could contain identifiable information.** Aggregate or fully anonymize first — and if that's not possible, don't use AI on that data at all.
- **Never as the sole validator of an indicator target.** Target-setting needs your actual baseline data and sector judgment, not a generic benchmark.
- **Never to fabricate a completion or impact percentage.** If the real dataset isn't available, ask for the data to be pulled — don't ask AI to estimate a plausible-sounding number as a stand-in.
- **Never to draft final evaluation conclusions or ratings.** Turning evidence into a judgment is the evaluator's job; AI can organize the evidence, not weigh it.
- **Never to translate or adapt a survey instrument into another language without a bilingual reviewer checking cultural and semantic accuracy** — a mistranslated question can silently bias an entire dataset.

## Example prompts

**1. (Beginner)** "What indicators does Sphere recommend for measuring food security and nutrition outcomes, and what's the minimum standard for each?"
*Why it works: a direct standards lookup, answerable via `search_standards` with a citation for each indicator.*

**2. (Beginner)** "Review this survey question for leading or double-barreled phrasing: '[paste question]'"
*Why it works: a narrow, mechanical linguistic check with no data involved — easy to verify the answer yourself.*

**3. (Intermediate)** "Compare our draft indicator list [paste, no PII] against Sphere's WASH key indicators and tell me which of ours map to an established Sphere indicator versus are custom, citing the Sphere reference for each match."
*Why it works: requires a citation per matched item, so you can spot-check the mapping rather than trust it wholesale.*

**4. (Intermediate)** "Draft 5 candidate qualitative codes for analyzing responses to the open-ended question 'What barriers did you face accessing [service]?' based on common barrier categories in humanitarian access literature. I'll validate these against our own anonymized transcripts."
*Why it works: explicitly frames the output as a draft to be validated against real data, not a finished coding scheme.*

**5. (Intermediate)** "Pull the most recent HDX HAPI indicators available for [sector] in [country] and tell me what baseline data exists that we could use to set a realistic indicator target."
*Why it works: uses the live data tool for grounding instead of guessing at a target number from general knowledge.*

**6. (Advanced)** "Act as a MEAL technical reviewer: read this draft logframe indicator table [paste] and flag every indicator that is not SMART (specific, measurable, achievable, relevant, time-bound), explaining which criterion it fails."
*Why it works: applies a named, consistent framework and bounds the task to flagging, not rewriting — the decision authority stays with you.*

**7. (Advanced)** "Given this list of already-anonymized, aggregated theme frequencies from our qualitative analysis [paste counts only, no quotes or identifiers], draft a plain-language summary paragraph suitable for a donor report, and flag any theme where the sample size seems too small to generalize."
*Why it works: the input is explicitly restricted to aggregated counts, and the model is asked to flag its own uncertainty about small-N generalization rather than presenting every theme with equal confidence.*

**8. (Advanced)** "Draft an accountability-to-affected-people feedback loop description for a cash program, referencing CHS commitments 5 and 7, in a format I can hand to a designer."
*Why it works: names the specific commitments by number and specifies the downstream format, avoiding a vague "make this better" ask.*

## Verify before you act

- Never paste raw transcripts, open-ended responses, or interview notes that could contain names or locations — aggregate or anonymize first, and skip AI entirely if you can't.
- Validate any AI-suggested coding framework against a sample of real, anonymized data with a second coder before applying it at scale.
- Confirm indicator target numbers against your own baseline dataset — an AI-suggested target is a starting point, not a commitment.
- Have a MEAL technical lead review any SMART-indicator gap list before changing a logframe already agreed with a donor.
