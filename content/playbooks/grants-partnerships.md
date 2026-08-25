---
id: grants-partnerships
title: Grants & Partnerships Officer Playbook
role: Grants & Partnerships Officer
icon: 🤝
skill_levels: [beginner, intermediate, advanced]
summary: Using HAI for donor compliance checks, budget narrative drafting, and due diligence summaries — always grounded in the actual current guidance text, never model memory of donor rules.
---

# Grants & Partnerships Officer Playbook

Donor rules change every funding round, and getting them wrong costs real money and real relationships. The one rule that governs everything else in this playbook: **never ask AI to recall a donor's rules from memory.** Paste the actual current guidance, RFA, or checklist text, and ask AI to work only from what's in front of it.

## Where AI genuinely helps in this role

1. **Cross-checking a draft proposal or report against a specific donor's compliance checklist** — when you provide the actual checklist text.
2. **Drafting first-pass budget narrative language** from a line-item budget and activity description you supply.
3. **Summarizing publicly available information** (registration status, published reports) as a starting point for a partner due diligence file.
4. **Drafting partnership agreement clause language** for legal or grants staff to review — not to finalize.
5. **Extracting eligibility criteria and deadlines** from a long donor call or RFA document into a quick-reference bullet list.

## Where AI should NOT be used

- **Never rely on AI's memory of donor rules** — USAID, ECHO, BHA, FCDO, or any other donor's requirements shift per call and per year. Always paste the current guidance and constrain AI to that text.
- **Never let AI make the final due diligence risk determination on a partner.** That call requires the actual verification steps — registration checks, reference calls, sanctions screening — done by a person.
- **Never submit AI-drafted compliance language without a grants specialist verifying it against the live donor portal or guidelines.**
- **Never paste a partner's confidential financial or personal data into a due diligence prompt.** Work from redacted summaries only.
- **Never treat an AI-drafted budget narrative number as authoritative.** It should mirror the actual budget file, not recalculate or estimate figures.

## Example prompts

**1. (Beginner)** "Summarize this donor RFA document [paste actual text] into a bullet list of eligibility criteria and the submission deadline."
*Why it works: works from pasted primary text rather than model memory of donor rules, and the extraction task is bounded and easy to spot-check.*

**2. (Beginner)** "What are Sphere's Shelter and Settlement minimum standards I should reference in a shelter proposal's technical approach section?"
*Why it works: a general standards lookup, answerable with a citation, with no donor-specific or partner-specific risk involved.*

**3. (Intermediate)** "Using only this line-item budget [paste] and this activity description [paste], draft a budget narrative paragraph explaining the cost basis for the staffing line. Don't invent any figure not in the budget."
*Why it works: an explicit anti-fabrication instruction restricts the model to the provided data rather than letting it interpolate plausible-sounding numbers.*

**4. (Intermediate)** "Compare this draft proposal section [paste] against this donor compliance checklist [paste actual checklist text] and list any checklist item not addressed."
*Why it works: both sides of the comparison are pasted primary text, not recalled from memory, so the resulting gap list is checkable against real documents.*

**5. (Intermediate)** "Draft a due diligence summary template — headers and prompts only, not content — for assessing a new local partner, covering registration, governance, financial management, and safeguarding."
*Why it works: requests a structural template, not a real judgment about a real partner, so no confidential data needs to enter the prompt.*

**6. (Advanced)** "Act as a compliance reviewer: given this current [donor] cost principles excerpt [paste] and our draft budget narrative [paste], flag any language that doesn't align with the excerpt, citing the specific clause."
*Why it works: grounds every flag in pasted source text with a citation requirement, closing off the risk of relying on stale donor-rule memory.*

**7. (Advanced)** "Draft 3 clauses for a sub-award agreement covering data protection responsibilities, referencing the IASC Data Responsibility principles on confidentiality and personal data protection, for our legal team to review."
*Why it works: names the specific principles being drawn on and explicitly routes the output to legal review rather than treating it as final language.*

**8. (Advanced)** "Given this partner's publicly available annual report and registration record [paste public excerpts], summarize what's verifiable from public sources and separately list what still needs verification through direct outreach or reference checks."
*Why it works: explicitly separates what's confirmed from public sources from what still needs human follow-up, preventing the summary from reading as a completed due diligence file when it isn't one.*

## Verify before you act

- Always paste the actual current donor guidance or RFA text rather than asking AI to recall rules from memory — requirements change per funding round.
- Have a grants specialist verify any AI-generated compliance gap list against the live donor portal before submission.
- Complete required due diligence steps — sanctions screening, reference checks, registration verification — through the actual verification channels. An AI summary of public information is a starting point, not a substitute.
- Confirm every number in a budget narrative against the actual budget file, line by line, before submission.
