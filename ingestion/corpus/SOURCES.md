# Humanitarian Corpus — Sources

Download date for all files below: **2026-08-25**.

Note on provenance: the canonical publisher domains for these documents
(`spherestandards.org`, `interagencystandingcommittee.org`) are behind bot-challenge
WAFs (Cloudflare / AWS WAF) that block non-browser HTTP clients. Every file here was
retrieved from an official secondary mirror of the same publisher-issued PDF
(UNHCR's Emergency Handbook document library, or the CCCM Cluster's S3-hosted
resource library). Content was verified against the publisher's own copyright page
embedded in each PDF where present. No content originates from a non-official
republisher (e.g. no Scribd/summary sites were used).

| File | Title | Edition/Year | Size | License |
|---|---|---|---|---|
| `Sphere-Handbook-2018-EN.pdf` | The Sphere Handbook: Humanitarian Charter and Minimum Standards in Humanitarian Response | 4th edition, 2018 | 6.0 MB (458 pp) | **All rights reserved** — see flag below |
| `CHS-2024.pdf` | The Core Humanitarian Standard on Quality and Accountability | 2024 Edition | 220 KB (6 pp) | Free educational reproduction w/ attribution; translation/adaptation needs written permission |
| `IASC-Data-Responsibility-2023.pdf` | IASC Operational Guidance on Data Responsibility in Humanitarian Action | April 2023 (2nd edition) | 916 KB (44 pp) | Presumed IASC general-distribution terms — not independently confirmed, see flag below |
| `IASC-Protection-Policy-2016.pdf` | IASC Policy on Protection in Humanitarian Action | October 2016 | 640 KB (40 pp) | Presumed IASC general-distribution terms — not independently confirmed, see flag below |
| `IASC-Disability-Inclusion-2019.pdf` | IASC Guidelines on the Inclusion of Persons with Disabilities in Humanitarian Action | July 2019 | 2.0 MB (110 pp) | © IASC 2019. Reproduction/translation authorized, non-commercial only |

---

## 1. Sphere Handbook 2018 (English)
- **Direct URL used:** `https://emergency.unhcr.org/sites/default/files/2024-01/Sphere-Handbook-2018-EN.pdf`
- **Canonical publisher page:** https://spherestandards.org/handbook-2018/ (PDF at spherestandards.org returns HTTP 403 / Cloudflare challenge to non-browser clients)
- **License — ⚠️ FLAG, does NOT match the assumed CC BY-SA 4.0:** The Handbook's own copyright page (p.3) reads verbatim:
  > "Copyright © Sphere Association, 2018 ... All rights reserved. This material is copyrighted but may be reproduced without fee for educational purposes, including for training, research and programme activities, provided that the copyright holder is acknowledged. It is not intended for resale. For copying in other circumstances, posting online, reuse in other publications or for translation or adaptation, prior written permission must be obtained by emailing info@spherestandards.org."

  This is **not** a Creative Commons license and does **not** permit redistribution/posting online/reuse in other publications without written permission from Sphere Association. Sphere's general "Intellectual Property" page (spherestandards.org/intellectual-property/) states other Sphere *resources* are released under CC BY 4.0, but the Handbook PDF itself explicitly reserves rights and requires permission for reuse beyond direct educational/training/research/programme use. **Recommend: keep local for RAG ingestion (falls under "research and programme activities"), but do NOT commit to a public repo or redistribute externally without contacting info@spherestandards.org for written permission. Gitignore candidate.**

## 2. Core Humanitarian Standard (CHS) 2024 revision
- **Direct URL used:** `https://emergency.unhcr.org/sites/default/files/2024-01/4.%20The%20Core%20Humanitarian%20Standard%20on%20Quality%20and%20Accountability.pdf`
- **Canonical publisher page:** https://www.corehumanitarianstandard.org/ (site is a JS-driven interactive handbook, no static PDF link found; FAQ at corehumanitarianstandard.org/faq describes terms)
- **License:** Copyright held jointly by CHS Alliance, Groupe URD and Sphere. Per the official FAQ: "The copyright holders welcome reproduction of the CHS for educational purposes, including in training, research and programme activities, provided that the CHS is acknowledged. To translate or adapt all or any part of the CHS, written permission must be obtained." No explicit copyright/license text is embedded in this particular 6-page PDF (it is the short-form standard text only, not the full guidance notes edition) — the terms above come from the publisher's FAQ page, not the file itself.
- Freely usable for this RAG project (educational/research use); do not redistribute a modified/translated version without permission.

## 3–4. IASC operational guidance documents
Two of the three requested IASC documents were obtained (the Centrality of Protection policy was substituted with its closest available equivalent — see note).

### a. IASC Operational Guidance on Data Responsibility in Humanitarian Action (2023)
- **Direct URL used:** `https://emergency.unhcr.org/sites/default/files/2023-11/IASC%20Operational%20Guidance%20on%20Data%20Responsibility%20in%20Humanitarian%20Action,%202023.pdf`
- **Canonical publisher page:** https://interagencystandingcommittee.org/operational-response/iasc-operational-guidance-data-responsibility-humanitarian-action (blocked to non-browser clients by AWS WAF challenge — HTTP 202 "x-amzn-waf-action: challenge")
- **License:** ⚠️ No copyright/license page found in the extracted text of this specific PDF. IASC's standard boilerplate on sibling documents (see Disability Inclusion doc below) states IASC materials are "issued for general distribution" with reproduction/translation "authorized, except for commercial purposes." This is presumed to apply here as IASC's consistent house policy, but it is **not independently confirmed within this file** — flagging for review before treating as fully verified.

### b. IASC Policy on Protection in Humanitarian Action (2016)
- Requested item was the "Centrality of Protection" policy; the closest/authoritative source is this 2016 IASC Policy on Protection in Humanitarian Action, which is the document that formally establishes the Centrality of Protection principle (the IASC's 2013 Centrality of Protection statement is folded into this policy).
- **Direct URL used:** `https://emergency.unhcr.org/sites/default/files/2024-01/4.%20IASC%20Policy%20on%20Protection%20in%20Humanitarian%20Action,%202016.pdf`
- **Canonical publisher page:** https://interagencystandingcommittee.org/iasc-protection-priority-global-protection-cluster/iasc-policy-protection-humanitarian-action-2016 (blocked to non-browser clients, same AWS WAF challenge)
- **License:** ⚠️ Same as above — no in-document copyright/license page found; presumed IASC general-distribution terms, not independently confirmed in this file.

### c. IASC Guidelines on the Inclusion of Persons with Disabilities in Humanitarian Action (2019)
- **Direct URL used:** `https://s3.eu-west-1.amazonaws.com/cccmcluster.org/public/2019-11/iasc_guidelines_on_the_inclusion_of_persons_with_disabilities_in_humanitarian_action_2019.pdf` (mirrored by the CCCM Cluster; the publisher's own site is behind the same AWS WAF challenge as above)
- **Canonical publisher page:** https://interagencystandingcommittee.org/iasc-guidelines-on-inclusion-of-persons-with-disabilities-in-humanitarian-action-2019
- **License:** Confirmed in-document (p. xiii): "Copyright © Inter-Agency Standing Committee (IASC) 2019. All rights reserved. This document is issued for general distribution. Reproductions and translations are authorized, except for commercial purposes, provided the source is acknowledged." — freely redistributable non-commercially with attribution. **Safe to commit.**

## 5. Multilingual track (optional) — NOT obtained
- Attempted Sphere Handbook 2018 French and Arabic PDFs.
- The only direct Arabic URL found (`spherestandards.org/wp-content/uploads/The-Sphere-Handbook-2018-AR-2.pdf`, surfaced via a medbox.org mirror page) points back to the Cloudflare-protected spherestandards.org domain and returns HTTP 403 to curl.
- Guessed UNHCR mirror paths for `-FR`/`-AR` suffixes (following the English mirror's naming pattern) returned HTTP 302 redirects to non-existent resources (i.e., not present on that mirror).
- No further mirror was found within a reasonable search effort. **Not downloaded — skipped per "optional if easy" instruction.**

## Not attempted / blocked entirely
None of the requested documents were fully unobtainable — all 5 primary targets were acquired via mirrors. Only the optional multilingual Sphere editions were skipped.

---

## Summary of license flags for follow-up decision

| File | Redistribution safe? | Action needed |
|---|---|---|
| `Sphere-Handbook-2018-EN.pdf` | **No** — all rights reserved, no online posting/reuse without written permission | Keep local only; add to `.gitignore`; consider emailing info@spherestandards.org for permission if this repo will ever be shared/published |
| `CHS-2024.pdf` | Educational/research use OK; no redistribution of modified/translated versions | Keep as-is, attribute CHS Alliance/Groupe URD/Sphere |
| `IASC-Data-Responsibility-2023.pdf` | Presumed OK (unconfirmed in-file) | Verify against IASC's site terms of use before treating as fully cleared |
| `IASC-Protection-Policy-2016.pdf` | Presumed OK (unconfirmed in-file) | Same as above |
| `IASC-Disability-Inclusion-2019.pdf` | **Yes** — confirmed non-commercial reuse with attribution | No action needed |
