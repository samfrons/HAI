---
id: communications
title: Communications Officer Playbook
role: Communications Officer
icon: 📰
skill_levels: [beginner, intermediate, advanced]
summary: Using HAI for sitrep summarization, donor reporting drafts, and multilingual drafting — with every fact traced back to a source before publication.
---

# Communications Officer Playbook

Communications work is where an AI-invented statistic or a mistranslated protection term does the most damage fastest, because it goes out publicly. The rule that makes AI safe to use here is simple: AI can touch the prose, but every fact in that prose has to trace back to a document you gave it or a source it retrieved — never to what the model "remembers."

## Where AI genuinely helps in this role

1. **Summarizing lengthy sitreps or reports** into a shorter internal or public-facing brief.
2. **Drafting a first-pass donor report narrative** from bullet-point inputs and indicator data you supply.
3. **Multilingual drafting support** for public communications — a first pass that a native or fluent speaker then reviews.
4. **Pulling current ReliefWeb updates** on a crisis to draft a situation snapshot with dates and sources attached.
5. **Producing multiple framing variants** of the same fact set — outcome-focused, needs-focused, partnership-focused — for different audiences.

## Where AI should NOT be used

- **Never publish AI-drafted content about an active crisis without a fact-check pass** against a primary source — a ReliefWeb report, an OCHA sitrep, a cluster update.
- **Never draft messaging that names or identifies specific beneficiaries, survivors, or vulnerable individuals.**
- **Never let AI draft final messaging on a politically sensitive or conflict-related topic without senior sign-off** — nuance errors here carry real safety and reputational risk.
- **Never treat an AI translation as publication-ready.** Route it through a native or fluent speaker first, especially for terms with legal or protection significance.
- **Never let AI invent a statistic or attribute a figure to a source it hasn't actually retrieved.**

## Example prompts

**1. (Beginner)** "Summarize this sitrep [paste public document] into 5 bullet points for an internal team update."
*Why it works: the input is already a public document, the output length is bounded, and the task is low-risk since nothing new is being asserted.*

**2. (Beginner)** "Pull the latest ReliefWeb updates on [crisis] from the past week and list the headlines with dates and sources."
*Why it works: uses the live data tool and requests dates and sources per item, so the summary is independently checkable.*

**3. (Intermediate)** "Draft a 150-word public update on our [sector] response in [context], using only the figures I provide here [paste figures]. Do not add any statistic I haven't given you."
*Why it works: an explicit instruction against fabricating numbers, plus a word-count constraint that controls format.*

**4. (Intermediate)** "Translate this English program update into [language] at a reading level appropriate for a general community audience, and flag any phrase you're unsure translates precisely."
*Why it works: asks the model to surface its own translation uncertainty instead of presenting a guess with false confidence.*

**5. (Intermediate)** "Rewrite this donor report paragraph [paste] in a more concise, results-focused tone, keeping every number and citation exactly as written."
*Why it works: separates what AI can touch (prose, tone) from what it can't (facts, citations) — the instruction makes that boundary explicit.*

**6. (Advanced)** "Act as an editor: read this draft press statement [paste] and flag any claim that isn't sourced to a document I've provided, any language that could compromise beneficiary anonymity, and any term that doesn't match IASC-standard terminology."
*Why it works: three distinct, checkable review criteria — sourcing, anonymity, terminology — replace an open-ended "improve this" that would be hard to verify.*

**7. (Advanced)** "Draft 3 alternate versions of this donor report executive summary [paste]: one emphasizing outcomes, one emphasizing needs context (citing the ReliefWeb/HDX data used), and one emphasizing partnership. Keep the underlying facts identical across all three."
*Why it works: fixes the factual content as a constant and isolates framing as the only variable, so you're comparing tone choices, not accidentally comparing different facts.*

**8. (Advanced)** "Given this cluster-level sitrep [paste, public], draft a table comparing reported needs by sector against Sphere's four technical chapters, and note which sectors have the least standards coverage in this update."
*Why it works: a structured cross-reference against a named framework, with the output format specified up front.*

## Verify before you act

- Fact-check every number and quote in an AI draft against the primary source before it goes external — treat the draft as unverified until you've checked it line by line.
- Route anything naming individuals, survivors, or specific communities through a protection review before publication.
- Have a native or fluent speaker review any AI-assisted translation before public use, especially for legal, protection, or medical terms.
- Get senior or comms-lead sign-off on anything touching a politically sensitive angle of a crisis, no matter how polished the AI draft reads.
