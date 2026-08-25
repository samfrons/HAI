---
id: effective-prompting
title: Effective Prompting for Humanitarian Work
skill_levels: [beginner, intermediate, advanced]
summary: A skill-progressive guide to writing prompts that get accurate, citable, actionable answers from HAI — with every example drawn from real humanitarian scenarios.
---

# Effective Prompting for Humanitarian Work

A good prompt isn't a magic phrase — it's a clearly scoped question with enough context that the answer can be checked. This guide walks from the basics up to the techniques experienced users rely on daily. Every example uses a real humanitarian scenario, because the habits that work for "summarize this sitrep" are different from the habits that work for "help me plan a response."

## Beginner: the anatomy of a good prompt

A prompt that works well usually has three parts:

1. **What you want** — a specific action (summarize, compare, draft, look up), not a vague one ("help me with").
2. **The scope** — what's in bounds and what's out. A country, a date range, a document, a sector.
3. **The format** — how you want the answer shaped, so you can use it without reformatting.

Compare these two prompts:

> ❌ "Tell me about water standards."
> ✅ "What does Sphere specify as the minimum water quantity per person per day for a general distribution scenario, and which technical chapter is that from?"

The second version tells HAI exactly what to look up (a specific indicator), where to look (Sphere), and implicitly asks for a citation (the chapter). The first version could produce three paragraphs of generalities that are hard to act on or verify.

Another comparison:

> ❌ "Summarize the situation in [country]."
> ✅ "Summarize ReliefWeb updates on [crisis] from the last 7 days into 5 bullet points, each with its source and date."

Adding a timeframe, a bullet count, and a citation requirement turns an open-ended request into something you can check line by line.

## Beginner: iteration is normal, not a failure

The first answer rarely comes back exactly right, and that's fine — treat the first response as a draft, not a verdict. If the scope is too broad, narrow it: "That covered too much — focus only on the WASH-related updates." If the format isn't useful, ask for a different one: "Put that in a table instead of prose." Iterating on a prompt takes seconds and almost always beats trying to write the perfect prompt on the first try.

## Intermediate: asking for sources

Every claim HAI makes about a standard, a figure, or a piece of guidance should be traceable to something you can check — either a passage in the standards corpus or a live data pull. Build that into the prompt rather than checking it after the fact:

> "Using CHS commitment 4 (support that does not cause harm), draft 3 bullet points for our proposal's do-no-harm section for a WASH project in [context]. Cite the specific commitment language you're drawing from."

> "Pull the latest HDX HAPI displacement figures for [region] and give me the number with its source and date — don't round or estimate."

If an answer doesn't come with a source, ask for one directly: "Where is that from — can you point me to the specific passage or dataset?" If HAI can't produce one, treat the claim as unverified.

## Intermediate: structured outputs

Asking for a specific format does two things: it makes the answer directly usable, and it makes gaps visible. A table with an empty cell is obviously incomplete; a paragraph with a missing fact just reads as vague.

> "Compare this draft indicator list [paste] against Sphere's WASH key indicators. Output a table with columns: our indicator, matching Sphere indicator (or 'custom'), and the Sphere citation."

> "List the eligibility criteria and submission deadline from this donor RFA [paste] as a bulleted checklist."

## Intermediate: multilingual prompting

HAI can draft in and translate to other languages, but treat the output as a first pass for a fluent-speaker review, not a finished translation — especially for terms with legal, medical, or protection significance where a slightly-off word choice changes meaning.

> "Translate this program update into French at a reading level appropriate for a general community audience, and flag any phrase you're unsure translates precisely."

> "Draft this same complaints-mechanism explanation in both English and Swahili, keeping the meaning of 'confidential' and 'safe to report' as close as possible in both — flag any term where a direct translation might lose nuance."

Asking the model to flag its own uncertainty is more useful than asking it to just produce a confident-sounding translation.

## Advanced: role framing and bounded tasks

Telling HAI to act as a specific kind of reviewer narrows what it looks for, which makes the review more useful and easier to check:

> "Act as a MEAL technical reviewer: read this draft logframe indicator table [paste] and flag every indicator that is not SMART (specific, measurable, achievable, relevant, time-bound), explaining which criterion it fails."

Notice this prompt does three things advanced users rely on: it names a role, it names a specific framework to check against (SMART), and it bounds the task to *flagging*, not *deciding* — the model surfaces problems, you make the call.

## Advanced: separating grounded content from inference

For any task that mixes retrieval (standards, live data) with reasoning (drafting a theory of change, connecting two sectors), ask the model to distinguish what it's citing from what it's inferring:

> "Draft a one-paragraph theory of change for an integrated nutrition and WASH response in [context], referencing the linkage between Sphere's WASH and Food Security and Nutrition chapters. Flag anything in your draft that's your own inference versus something grounded in a cited source."

This single instruction — "flag your inference" — is the difference between a draft you can trust at a glance and one you have to re-derive from scratch to check.

## Advanced: anti-fabrication instructions

When you're supplying the facts and only want help with structure or language, say so explicitly:

> "Using only this line-item budget [paste] and this activity description [paste], draft a budget narrative paragraph for the staffing line. Don't invent any figure not in the budget."

Without that instruction, a model asked to "make this sound more complete" may fill perceived gaps with plausible-sounding numbers. With it, a missing figure becomes a visible gap instead of an invisible guess.

## A quick checklist before you send a prompt

- Did I say exactly what I want (summarize / compare / draft / look up)?
- Did I scope it (country, date range, document, sector)?
- Did I specify the format I need back?
- If facts matter, did I ask for sources or restrict the model to data I provided?
- Did I check the response for a citation, not just plausibility?
