# Humanitarian Corpus — Sources

Download date for the first five files below: **2026-08-25**. Phase C1 additions
(items 6–12): **2026-09-01**.

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
| `FEWS-NET-Scenario-Development-2018.pdf` | FEWS NET Guidance Document: Scenario Development for Food Security Early Warning | Jan 2018 | 1.1 MB (50 pp) | UNVERIFIED — site-level attribution norm, not doc-confirmed |
| `FEWS-NET-Matrix-Analysis-2021.pdf` | FEWS NET Guidance Document: Matrix Analysis | May 2021 | 1.1 MB (28 pp) | UNVERIFIED — same as above |
| `WHO-Health-Cluster-Guide-2020.pdf` | Health Cluster Guide: A Practical Handbook | 2020 | 4.5 MB (456 pp) | **CC BY-NC-SA 3.0 IGO, confirmed in-document** |
| `WFP-SCOPE-Brief-2019.pdf` | WFP SCOPE Brief | Sept 2019 | 1.7 MB (2 pp) | UNVERIFIED — no in-file license, publicly served without login |
| `HDX-docs-2026.md` | The Humanitarian Data Exchange (HDX) — platform and API overview | compiled 2026-09-01 | — | Original summary; underlying pages' content license UNVERIFIED |
| `KoboToolbox-docs-2026.md` | KoboToolbox — data collection platform overview | compiled 2026-09-01 | — | Original summary; claimed CC license on docs **could not be confirmed** |
| `FEWS-NET-about-2026.md` | About FEWS NET — organisation and methodology overview | compiled 2026-09-01 | — | Original summary; same attribution-norm treatment as the two FEWS NET PDFs |

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

## 6. FEWS NET Guidance Document: Scenario Development for Food Security Early Warning (Jan 2018)
- **Direct URL used:** `https://fews.net/sites/default/files/documents/reports/Guidance_Document_Scenario_Development_2018.pdf`
- **Canonical publisher page:** https://fews.net/products/guidance-documents (fews.net is directly reachable, no WAF challenge encountered)
- **License:** No copyright/license page found in the extracted text beyond "©Cover photos: FEWS NET and Flickr Creative Commons." fews.net's site-level Data Attribution policy (linked from the site footer, `help.fews.net/fdp/data-and-information-use-and-attribution-policy`) states site content "may be distributed or copied freely ... with the request that FEWS NET be cited as the source," but that policy's own text was not independently captured, and it is scoped to the website generally rather than confirmed for this specific PDF. **UNVERIFIED — treat cite-with-attribution as the working assumption, not a confirmed grant.**
- Verified: real 50-page PDF (1,171,799 bytes, sha256 in `fetch-corpus.sh`), content matches the FEWS NET Guidance Document Series branding and the described eight-step scenario-development methodology.

## 7. FEWS NET Guidance Document: Matrix Analysis — Integrated Analysis of Survey-Based Indicators for Classification of Acute Food Insecurity (May 2021)
- **Direct URL used:** `https://fews.net/sites/default/files/documents/reports/fews-net-matrix-guidance-document.pdf`
- **Canonical publisher page:** https://fews.net/products/guidance-documents
- **License:** Same as item 6 — no in-document copyright/license statement beyond the cover-photo credit. **UNVERIFIED**, same working assumption.
- Verified: real 28-page PDF (1,156,664 bytes, sha256 in `fetch-corpus.sh`), title matches exactly ("FEWS NET Matrix Analysis: Integrated analysis of survey-based indicators for classification of acute food insecurity"), authored by Chris Hillbruner under the FEWS NET USAID contract.

## 8. WHO / Global Health Cluster — Health Cluster Guide: A Practical Handbook (2020)
- **Direct URL used:** `https://www.infocop.es/pdf/HealthGuide.pdf` (secondary mirror; canonical WHO/Global Health Cluster URL not independently re-tested but content matches WHO/Global Health Cluster branding exactly)
- **License — confirmed in-document, verbatim (p.2):** *"© World Health Organization 2020. Some rights reserved. This work is available under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0 IGO licence (CC BY-NC-SA 3.0 IGO; https://creativecommons.org/licenses/by-nc-sa/3.0/igo). Under the terms of this licence, you may copy, redistribute and adapt the work for non-commercial purposes, provided the work is appropriately cited."* Cleanest license of everything added in this round. **Safe for non-commercial reuse with attribution.**
- Verified: real 456-page PDF (4,523,973 bytes, sha256 in `fetch-corpus.sh`), content opens "HEALTH CLUSTER GUIDE A PRACTICAL HANDBOOK" with Global Health Cluster acknowledgements matching the expected document exactly.

## 9. WFP SCOPE Brief (September 2019)
- **Direct URL used:** `https://executiveboard.wfp.org/document_download/WFP-0000001575` (WFP's own Executive Board public document repository; no login required)
- **License:** No copyright/license statement embedded in this 2-page brief. Treated the same way as the two IASC documents whose in-file terms are unconfirmed (items 3–4 above): **UNVERIFIED**, presumed publicly distributable given it is served without authentication from WFP's own public document platform, not independently confirmed as reusable beyond that. Fine for internal RAG indexing per this project's established "research and programme activities" reading; not confirmed for redistribution.
- Verified: real 2-page PDF (1,816,325 bytes, sha256 in `fetch-corpus.sh`), InDesign-produced, titled "WFP SCOPE Brief," content matches WFP's SCOPE beneficiary/transfer management platform exactly.

## 10–12. Data-ecosystem "about"/documentation pages (hand-compiled, not fetched by `fetch-corpus.sh`)

Three sources describe humanitarian-data-ecosystem platforms rather than reproduce a single downloadable document. Each is a `.md` file **authored for this corpus** — a descriptive summary of what one or more official pages state, not a verbatim capture — because the source pages either render their text client-side (HDX's GitBook docs, `data.humdata.org` itself returns HTTP 403 to non-browser clients) or sit behind the WAF that already blocks every `unhcr.org`-family host in this project (UNHCR's own PRIMES pages and PDFs all returned HTTP 403, including via `web.archive.org` mirrors — same failure pattern as D5 in `CANDIDATES.md`, so UNHCR PRIMES documentation was **not obtained** this round). These three are committed directly to `ingestion/corpus/` rather than gitignored, since they are original text written for this project rather than a redistribution of someone else's document.

### a. `HDX-docs-2026.md`
- **Pages summarised:** `https://docs.humdata.org/` and `https://docs.humdata.org/about/hdx-terms-of-service` (HDX Documentation v2, official OCHA Centre for Humanitarian Data property), plus `https://hdx-hapi.readthedocs.io/en/latest/` (official HAPI documentation). Accessed 2026-09-01.
- **License:** HDX's own Terms of Service state organisations choose their own license per dataset and that "sharing data through HDX does not imply the transfer of any rights ... to OCHA" — that governs the *datasets* HDX hosts, not the documentation text summarised here. No content license was found for the documentation pages themselves. Summarised under the same "research and programme activities" fair-use reading applied to IASC/Sphere throughout this file.
- Deliberately does **not** state a specific dataset/organisation/location count: that figure is a live counter on `data.humdata.org`, which this project could not fetch directly (HTTP 403), and a WebSearch snippet quoting a number was not independently verified against a real page fetch — recorded honestly as "changes continuously, see the live site" rather than risking a stale or unverified figure in the corpus.

### b. `KoboToolbox-docs-2026.md`
- **Pages summarised:** `https://support.kobotoolbox.org/` (official KoboToolbox documentation landing page) and `https://github.com/kobotoolbox/docs` (source repository for that site). Accessed 2026-09-01.
- **License:** The task brief asked to verify a claimed CC license on Kobo's docs — **could not confirm**. The support site's footer names only "Terms of Service" and "Privacy Policy," no content license; the `kobotoolbox/docs` GitHub repository's license file was not retrievable through the tools available this round (only the `kpi` server code's AGPL-3.0 license was confirmed, which covers code, not documentation prose). Recorded as **UNVERIFIED** in the file itself rather than assumed CC-licensed.

### c. `FEWS-NET-about-2026.md`
- **Pages summarised:** `https://fews.net/about` and `https://fews.net/about/our-work`. Accessed 2026-09-01.
- **License:** Same UNVERIFIED/attribution-norm treatment as items 6–7 above (FEWS NET's Data Attribution policy is linked but its full text wasn't independently captured).
- Distinct in purpose from `fews_net_scenario`/`fews_net_matrix`: this file describes FEWS NET as an *organisation* (USAID origin, partnership model, what it does) rather than its scenario-development or matrix-analysis methodology in full technical detail, closing the "What is FEWS NET?" class of eval gap.

## Candidates researched but not ingested this round

- **UNHCR PRIMES documentation** — every `unhcr.org` URL tried (the PRIMES/registration pages, the PRIMES flyer PDF under `unhcr.org/blogs`) returned HTTP 403, including through `web.archive.org` mirrors (which themselves intermittently 503'd). Same WAF family already documented for other UNHCR direct-host fetches in this project. Not obtained; needs a human/browser session, not another automated pass.
- **ACLED "about"/methodology page** — fetched and read (`acleddata.com/conflict-data/knowledge-base/methodology`), but **not ingested**. ACLED's EULA (`acleddata.com/eula`), quoted verbatim: *"Licensee is not permitted to reproduce, republish, redistribute, or create derivative works from any of ACLED's Analysis, photographs, or videos."* "Analysis" is not defined narrowly enough to exclude ACLED's own descriptive methodology text, and derivative materials must be "transformative" enough that they "cannot be reverse engineered to recreate the Licensed Content" — a summary of ACLED's own methodology page does not clearly meet that bar. Consistent with `CANDIDATES.md`'s existing C4 recommendation (hold the ACLED Codebook for legal review), this project skipped ingesting ACLED's about/methodology content rather than assume a research-use exemption applies to a EULA that does not grant one.

## 13. Multilingual track (optional) — NOT obtained
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
| `FEWS-NET-Scenario-Development-2018.pdf` | Presumed OK (site-level attribution norm, unconfirmed in-file) | Verify against FEWS NET's Data Attribution policy before treating as fully cleared |
| `FEWS-NET-Matrix-Analysis-2021.pdf` | Presumed OK (same as above) | Same as above |
| `WHO-Health-Cluster-Guide-2020.pdf` | **Yes** — confirmed CC BY-NC-SA 3.0 IGO, non-commercial reuse with attribution | No action needed |
| `WFP-SCOPE-Brief-2019.pdf` | Presumed OK (public WFP Executive Board document, unconfirmed license) | Verify against WFP's site terms before treating as fully cleared |
| `HDX-docs-2026.md` | Original summary text; underlying pages' license unconfirmed | No action needed for the summary itself; don't treat as a verbatim HDX publication |
| `KoboToolbox-docs-2026.md` | Original summary text; claimed CC license on Kobo's docs unconfirmed | Re-verify Kobo docs license via the `kobotoolbox/docs` repo before citing it as CC-licensed anywhere user-facing |
| `FEWS-NET-about-2026.md` | Original summary text; same attribution-norm caveat as the FEWS NET PDFs | No action needed |
