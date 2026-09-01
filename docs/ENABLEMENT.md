# AI Enablement Framework

*How an organization adopts AI well: onboarding people to what exists, and knowing when to build what doesn't.*

HAI is both a working assistant and a vehicle for this framework — its playbooks, guides, and coach mode are the framework's first implementation.

## The core balance

Two failure modes bracket every organizational AI effort:

- **All onboarding, no building:** staff get ChatGPT licenses and a webinar; the org's actual comparative advantage — its data, standards, workflows, field knowledge — never reaches the tools. Usage plateaus at generic drafting.
- **All building, no onboarding:** engineering ships a custom tool into a workforce that hasn't formed the judgment to use *any* AI well. The tool gets blamed for misuse failures that are really literacy failures.

The framework: **onboard broadly on general tools first; instrument that adoption; build custom only where evidence shows general tools amplified by org-specific assets (data, standards, workflows) would do materially better.** HAI itself passed that test: generic chatbots fabricate standards citations and accept pasted case data — both fixable only with org-specific retrieval and safety layers.

## 1 — Onboarding staff (meet people where they are)

**Segment by work area × skill level, not by org chart.** A protection officer and a grants officer need different examples, cautions, and prompts; a beginner and a power user in the same role need different depth. This is why HAI ships six role playbooks ([`content/playbooks/`](../content/playbooks/)), each with skill-tagged prompts and role-specific "where AI should NOT be used" sections.

Principles that make training stick:

1. **Teach with real work, not toy examples.** Every example prompt in the playbooks is a task the role actually does, referencing the frameworks that role actually uses (Sphere, CHS, cluster system, HDX).
2. **Teach limits as prominently as capabilities.** "Never for beneficiary eligibility decisions; never with identifiable data; never as sole source for safety-critical protocols" appears in every playbook. Trust grows from honest boundaries.
3. **Teach through the tool, not beside it.** HAI's coach mode critiques the user's prompt before answering it; the citations panel shows how grounded answers are assembled; the PII interception explains *which* data-responsibility principle was at stake and how to rephrase. Every interaction is a micro-lesson.
4. **Verification is a skill, not a caveat.** Each playbook ends with role-specific verification habits ("verify before you act"), because the durable competency is calibrated trust, not prompt syntax.

## 2 — Identifying where custom solutions amplify what the org does best

Run adoption as an evidence pipeline, not a suggestion box:

| Signal | Where it comes from | What it indicates |
|---|---|---|
| Recurring prompt patterns | Shared prompt library, CoP sessions | A workflow worth templating (playbook entry) |
| Workarounds and near-misses | Office hours, safety interception logs (aggregate counts only) | A guardrail or integration gap |
| "I stopped using it because…" | Champion check-ins | A capability or trust gap |
| High-value tasks general tools can't do | Use-case register (below) | A candidate for custom build |

**The build/buy/wait test.** A use case earns engineering investment only when all four hold:

1. General tools demonstrably underperform *because* they lack org-specific assets (our standards corpus, our data feeds, our protection constraints) — not because users need more practice.
2. The task recurs across many staff or carries high stakes per occurrence.
3. Success is measurable (an eval can be written before the build starts).
4. The failure mode of the custom solution is safer than the failure mode of the status quo.

Keep a lightweight **use-case register**: proposer, affected roles, frequency × stakes, why general tools fall short, proposed measure of success, decision (build / adopt existing / wait with review date). Review quarterly with both program and technical voices in the room.

## 3 — Working groups and communities of practice

Structure (detailed facilitation guide: [`content/guides/starting-a-community-of-practice.md`](../content/guides/starting-a-community-of-practice.md)):

- **Champions network** — one volunteer per team/office, supported with early access and a direct line to the AI focal point; champions surface use cases and near-misses, they don't gatekeep.
- **Office hours** — recurring, drop-in, blame-free; near-misses discussed openly are the cheapest safety instrument the org can buy.
- **Prompt-sharing ritual** — a shared library where staff post prompts that worked, tagged by role and task; the best graduate into playbooks. This is also the use-case pipeline's richest source.
- **Working groups charter around decisions, not topics** — "should protection case summaries ever touch AI, and under what controls" is a working group; "AI in protection" is a mailing list.

**Measure leading indicators, not vanity metrics.** Weekly active users flatters; instead track: distinct *tasks* attempted per role, playbook prompts reused, near-misses reported (more reports = healthier culture, not worse behavior), use cases graduating from register to build, and time-to-first-productive-use for new staff.

## 4 — Making AI accessible to non-technical staff

- **Playbooks over manuals**: role-first entry points ("I'm a MEAL officer, show me") rather than feature-first documentation.
- **One-click starting points**: every playbook example has a "try in chat" button that pre-fills — but never auto-sends — the prompt. The person always makes the last decision; the habit of reading before sending *is* the training.
- **Responsible use as guidance, not policy-speak**: the [responsible-use guide](../content/guides/responsible-use.md) is written around realistic near-misses (the pasted case list) and a usable heuristic (the "public Slack channel" test), grounded in named IASC data-responsibility principles.
- **Multilingual access**: UI and starter prompts in EN/FR/AR/ES; the assistant follows the user's language. Accessibility includes language.

## Sequencing (first 90 days in an adopting org)

1. **Weeks 1–3:** champions recruited; role playbooks localized to the org's context; responsible-use guide adapted and endorsed by protection + data-responsibility focal points.
2. **Weeks 3–8:** onboarding sessions by work area; office hours begin; prompt library seeded; use-case register opened.
3. **Weeks 8–12:** first register review; one or two candidates selected against the build/buy/wait test; eval criteria written *before* any build begins.
4. **Ongoing:** quarterly register reviews; eval reports published internally with each product change; playbooks versioned like any other operational guidance.
