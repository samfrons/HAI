---
id: program-officer
title: Program Officer Playbook
role: Program Officer
icon: 🗂️
skill_levels: [beginner, intermediate, advanced]
summary: Using HAI for program design, proposal drafting, and workplan review — grounded in Sphere, CHS, and live crisis data rather than model memory.
---

# Program Officer Playbook

Program design and proposal writing run on judgment calls AI can't make — what a community actually needs, what's politically feasible, what a donor will fund this cycle. What AI can do is speed up the parts of the job that are mechanical: finding the right standard, summarizing a pile of sitreps, checking a draft against a checklist. Use it there, and keep the judgment calls yours.

## Where AI genuinely helps in this role

1. **Drafting first-cut theory-of-change or logframe language** against Sphere and CHS anchors, so you start from a structured draft instead of a blank page.
2. **Summarizing situation reports and crisis updates** (via live ReliefWeb data) into a needs-analysis section, with dates and sources attached so it's checkable.
3. **Cross-checking proposal indicators** against Sphere's key indicators for the relevant sector, flagging which are standard and which are custom.
4. **Turning bullet-point inputs into workplan narrative** — activity descriptions, sequencing rationale — that you then edit for accuracy and tone.
5. **Spotting compliance gaps** between a draft proposal and CHS's nine commitments before a technical reviewer sees it.

## Where AI should NOT be used

- **Never for the final go/no-go on program design trade-offs.** Whether to prioritize shelter over WASH in a given context is a contextual and often political judgment — AI can lay out the standards, not make the call.
- **Never with identifiable beneficiary data pasted into a prompt.** Needs data belongs in aggregate; case-level detail doesn't belong in a chat window.
- **Never as the sole word on indicator targets.** Targets need baseline data and sector-specialist sign-off, not a plausible-sounding number.
- **Never for donor-specific compliance rules from memory.** Donor requirements change per call — always work from the actual current guidance document, not what a model "remembers" about a donor.
- **Never to fill a gap in the data.** If a needs or coverage figure isn't available, ask HAI to pull it live or flag it as missing — don't let a plausible-sounding placeholder become the number that ships.

## Example prompts

**1. (Beginner)** "Summarize the last 30 days of ReliefWeb situation reports for [country] related to [crisis], and list the top 3 sectoral needs mentioned, with the source and date for each."
*Why it works: specific country and timeframe bound the search; asking for source and date per item makes the summary independently checkable rather than a vague impression.*

**2. (Beginner)** "What does Sphere specify as the minimum standard for safe drinking water access per person per day, and which technical chapter is it from?"
*Why it works: a direct factual question HAI can answer from `search_standards` with a citation — no ambiguity about what "answer" means.*

**3. (Intermediate)** "Using CHS commitment 4 (support that does not cause harm) and commitment 1 (participation and voice), draft 3 bullet points for our proposal's do-no-harm section for a WASH project in [context]. Cite the specific commitment language you're drawing from."
*Why it works: names the exact commitments by number, bounds the output to 3 bullets, and requires a citation — so you can verify the language actually traces back to CHS rather than a generic paraphrase.*

**4. (Intermediate)** "Pull the latest HDX HAPI population and displacement figures for [region] and draft a two-sentence needs-justification paragraph citing the data source and date."
*Why it works: requests a live pull instead of trusting a remembered number, and specifies the exact output length and required citation.*

**5. (Intermediate)** "Compare this workplan activity list [paste] against Sphere's Shelter and Settlement technical chapter and flag any standard activities we may have missed. Don't assume — cite the section for each flag."
*Why it works: explicit anti-hallucination instruction ("don't assume — cite"), and the task is scoped to flagging gaps, not deciding what to add.*

**6. (Advanced)** "Act as a reviewer: read this draft proposal narrative [paste, no beneficiary names] and identify every place a numeric claim needs a citation to Sphere, HDX, or ReliefWeb. List them as a table with the paragraph reference."
*Why it works: role framing plus a structured table output narrows the task to exactly one thing — finding uncited numbers — rather than an open-ended edit.*

**7. (Advanced)** "Draft a one-paragraph theory of change for an integrated nutrition and WASH response in [context], explicitly referencing the linkage between Sphere's WASH and Food Security and Nutrition chapters. Flag anything in your draft that's your inference versus something grounded in a cited source."
*Why it works: asks the model to separate grounded content from its own inference — a check most prompts skip, and one that matters most on cross-sector reasoning.*

**8. (Advanced)** "Given this indicator table [paste, anonymized], check whether each indicator matches an established Sphere key indicator or is custom, and note which custom indicators would need MEAL sign-off before submission."
*Why it works: bounded classification task that explicitly routes the harder decision — whether a custom indicator is acceptable — back to a human specialist instead of letting the model decide.*

## Verify before you act

- Confirm any Sphere or CHS citation against the actual handbook page before it goes into a proposal — retrieval can mis-locate context even when it looks confident.
- Cross-check donor-specific compliance language against the donor's current published guidelines, not a remembered summary — requirements shift by funding round.
- Get sector technical-lead sign-off on any indicator language before submission.
- Re-verify any live data figure (population, displacement, coverage) against the HDX or ReliefWeb source directly before publishing — a pulled number can be stale by the time a proposal is finalized.
