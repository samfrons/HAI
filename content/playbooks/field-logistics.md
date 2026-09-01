---
id: field-logistics
title: Field Logistics Officer Playbook
role: Field Logistics Officer
icon: 🚚
skill_levels: [beginner, intermediate, advanced]
summary: Using HAI for procurement document drafting, distribution planning aids, and supply pipeline queries — never for vendor decisions or real-time safety calls.
---

# Field Logistics Officer Playbook

Logistics work has two things AI should never touch: who gets a contract, and whether a distribution site is safe today. Everything short of those two calls — drafting language, checking a document against a standard, pulling supply data — is fair game.

## Where AI genuinely helps in this role

1. **Drafting first-pass procurement document language** — RFQ or tender descriptions — from the technical specs you provide.
2. **Drafting distribution planning checklists** referencing Sphere technical standards for the relevant sector, such as water point spacing or shelter plot sizing.
3. **Summarizing HDX HAPI supply, market, and price data** to inform a procurement planning brief.
4. **Drafting a generic distribution site flow-plan description** — crowd flow, queuing, protection considerations — for review by the field team.
5. **Cross-checking a draft procurement package** against a standard documentation checklist.

## Where AI should NOT be used

- **Never let AI select a vendor or make an award decision.** Procurement integrity requires the actual competitive process and a documented human decision.
- **Never paste actual beneficiary lists, headcounts by name, or household-level distribution data into a prompt.** Use aggregated numbers only.
- **Never rely on AI for real-time supply chain or market price data.** Always pull the live HDX HAPI or market monitoring data rather than trusting a remembered figure.
- **Never use AI-drafted content as the final safety or security assessment for a distribution site.** Site risk assessment needs an in-person or currently-informed security review.
- **Never let a procurement document go out with AI-drafted technical specs that haven't been checked by the technical or sector lead who knows the actual equipment needs.**

## Example prompts

**1. (Beginner)** "What does Sphere recommend as the minimum water quantity per person per day for a general distribution scenario?"
*Why it works: a direct factual lookup with a citation, and no site-specific data is needed to answer it.*

**2. (Beginner)** "Draft a generic RFQ template structure — section headers only — for procuring [item category]."
*Why it works: a template-only request keeps vendor and pricing data out of the prompt entirely.*

**3. (Intermediate)** "Pull the latest HDX HAPI market or price data available for [commodity] in [country] and summarize the trend over the last quarter with sources."
*Why it works: uses the live data tool and requires a sourced trend rather than a guessed or remembered figure.*

**4. (Intermediate)** "Using these technical specifications [paste specs], draft the technical requirements section of an RFQ for [item], keeping every spec exactly as given."
*Why it works: restricts the drafting to the provided specs, guarding against invented technical details slipping into a procurement document.*

**5. (Intermediate)** "Draft a distribution site flow-plan checklist for [item] distribution to approximately [aggregate number] households, referencing Sphere guidance on site planning and crowd management."
*Why it works: uses an aggregate household count rather than a household list, and cites a named standard as the basis for the checklist.*

**6. (Advanced)** "Act as a procurement compliance reviewer: given this draft procurement package [paste, redact vendor-identifying info if sensitive] and our standard procurement checklist [paste], list any required document that appears to be missing."
*Why it works: role-framed as a document-completeness check, explicitly not a vendor evaluation or award recommendation.*

**7. (Advanced)** "Compare the shelter plot sizing in this site plan draft [paste, aggregate figures only] against Sphere's Shelter and Settlement minimum standards, citing the specific standard and indicator."
*Why it works: uses aggregate, site-level figures rather than household-level data, and requires a citation to the exact chapter and indicator.*

**8. (Advanced)** "Given this list of recent HDX HAPI supply and market indicators for [region] [tool output], draft a one-page procurement risk brief flagging any commodity showing a price spike or supply constraint, and note where the data is more than 2 weeks old."
*Why it works: asks the model to flag its own data's recency, preventing a stale figure from being presented as current in a risk brief.*

## Verify before you act

- Confirm any market, price, or supply figure against the live HDX HAPI dashboard or a current market monitoring report before using it in a procurement decision — pulled data can be dated by the time a plan is finalized.
- Route every procurement document through the actual competitive procurement process and required human sign-offs — AI drafting doesn't replace the paper-trail integrity procurement compliance requires.
- Have the technical or sector lead verify AI-drafted technical specifications against actual equipment and material needs before an RFQ goes out.
- Get a current, field-informed security assessment for any distribution site plan. Never treat an AI-drafted flow-plan as a safety clearance.
