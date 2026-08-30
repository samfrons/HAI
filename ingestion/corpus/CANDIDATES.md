# Humanitarian Corpus — Candidate Sources (Phase C1 Research)

Research date: **2026-08-30**. This is a *vetting* document, not a download log — no
files listed here have been fetched into `ingestion/corpus/` yet (see `SOURCES.md`
for what's already ingested). Each candidate below was checked with a live
HTTP fetch against its direct URL and, where discoverable, its own copyright
page or the publisher's terms-of-use page — following the `SOURCES.md`
precedent that a publisher's general licensing reputation cannot be trusted
(Sphere's separate resources are CC BY 4.0, but the Handbook PDF itself is
all-rights-reserved). Every license field below is either a verbatim quote,
or explicitly marked **UNVERIFIED** — never guessed.

Confirmed WAF/bot-challenge blocks this round (matches the `spherestandards.org`
/ `interagencystandingcommittee.org` precedent — Cloudflare or AWS WAF
challenges non-browser clients): `ipcinfo.org` (whole host, incl. the
interactive manual page), `jiaf.info` (HTTP 444 connection reset),
`hhi.harvard.edu`, `unhcr.org` (direct host — Wayback Machine mirrors work).

---

## A. Operational standards depth

| # | Document | Ed/Year | Publisher | Download | License | Size |
|---|---|---|---|---|---|---|
| A1 | Health Cluster Guide: A Practical Handbook | 2020 | WHO / Global Health Cluster | Verified 200 (mirror) | **CC BY-NC-SA 3.0 IGO** | 456 pp / 4.5 MB |
| A2 | UNHCR Emergency Handbook | continuous, web-native | UNHCR | Not exportable as one doc | © UNHCR, no reuse clause found | N/A |
| A3 | IASC Guidelines for Integrating GBV Interventions in Humanitarian Action | 2015 | IASC | Verified 200 (direct) | UNVERIFIED | 326 pp / 7.3 MB |
| A4 | Inter-Agency Minimum Standards for GBV in Emergencies Programming | 2019 | UNFPA / GBV AoR | Verified 200 (UNFPA direct) | UNVERIFIED (bare © line) | 182 pp / 2.0 MB |
| A5 | Code of Conduct for the International Red Cross and Red Crescent Movement and NGOs in Disaster Relief | 1994 (still current) | IFRC/ICRC | Verified 200 (PDF direct; HTML detail page WAF-blocked) | UNVERIFIED | 7 pp / 37 KB |
| A6 | LEGS Handbook | 3rd ed., 2023 | Practical Action Publishing for LEGS Project | Verified 200 (direct) | **All rights reserved** | 392 pp / 5.6 MB |

**A1 — WHO Health Cluster Guide (2020).** URL: mirror at `infocop.es/pdf/HealthGuide.pdf` (canonical WHO URL not independently re-tested but content matches WHO/Global Health Cluster branding exactly). Copyright page, verbatim: *"© World Health Organization 2020. Some rights reserved. This work is available under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0 IGO licence (CC BY-NC-SA 3.0 IGO)."* Cleanest license found across the whole research pass. Why it earns space: covers health-cluster coordination (activation, HCT structure, PSEA, AAP) — a gap no current corpus document fills.

**A2 — UNHCR Emergency Handbook.** Web-native Drupal site of ~30+ "books," each a chain of short entries. `emergency.unhcr.org/print/view/pdf/pdf_per_book/pdf_per_book_pr?book_id[0]=<id>` returns a per-book PDF (tested: "Staff in Emergencies" → 36 pp / 194 KB) but there is no bulk/API export — ingestion would mean enumerating every `book_id` and stitching dozens of small PDFs; some content is staff-login-gated. Footer shows "© UNHCR 2001–2026" with no explicit reuse clause. **Recommend: defer** unless the multi-book scrape is worth the effort.

**A3 — IASC GBV Guidelines (2015).** Verified via `gbvguidelines.org` official host. No explicit copyright/license statement found on the acknowledgements/foreword pages checked — only the standard UN "designations employed" disclaimer and a suggested citation, no reuse grant. **UNVERIFIED**, treat as unconfirmed. Still the single most authoritative cross-sector GBV mainstreaming document (endorsed by all IASC principals) — real gap since GBV mainstreaming spans every sector.

**A4 — GBV AoR Minimum Standards (UNFPA, 2019).** Caution: the first URL found under `gbvaor.net` is actually the Monitoring & Evaluation Framework companion, not the core standards — the real 16-standards document is `unfpa.org/sites/default/files/pub-pdf/19-200_Minimun_Standards_Report_ENGLISH-Nov.FINAL_.pdf` (verified, 182 pp). Copyright page reads only *"Copyright UNFPA, 2019"* — no CC grant, no reuse language found. **UNVERIFIED**, treat as all-rights-reserved until proven otherwise.

**A5 — IFRC/ICRC Code of Conduct (1994).** The canonical `ifrc.org` document-detail page 403'd (WAF-style block on the HTML page only), but the direct PDF `ifrc.org/sites/default/files/2021-07/code-of-conduct-movement-ngos-english.pdf` returned 200. Bare Word-to-PDF export, no copyright page of its own; site-wide footer shows only a blanket "© 2026 IFRC," no specific reuse terms. **UNVERIFIED**, but worth pursuing given it's the field's most-cited foundational conduct/independence norm.

**A6 — LEGS Handbook 3rd ed. (2023).** Copyright page, verbatim: *"© Livestock Emergency Guidelines and Standards – LEGS, 2023 ... All rights reserved. No part of this publication may be reprinted or reproduced or utilised in any form ... without the written permission of the publishers."* Same Practical Action Publishing boilerplate as the Sphere Handbook. **Do not ingest without permission** — same flag pattern as Sphere in `SOURCES.md`.

---

## B. Rights & legal

| # | Document | Year | Publisher | Download | License | Size |
|---|---|---|---|---|---|---|
| B1 | 1951 Refugee Convention + 1967 Protocol | 1951/1967 | UN / UNHCR | Verified 200 (UN Treaty Collection, or UNHCR via Wayback) | **Public domain** | 68 pp/3.2 MB or 56 pp/547 KB |
| B2 | Guiding Principles on Internal Displacement | 1998 | UN OCHA (Deng/Egeland) | Verified 200 (ReliefWeb / UN Digital Library) | **Public domain** | 22 pp / 1.9 MB |
| B3 | ICRC "What is IHL?" fact sheet | 07/2004 | ICRC | Verified 200 (icrc.org direct) | Attribution-required, non-commercial (quoted below) | 2 pp / 33.7 KB |
| B4 | Geneva Conventions of 12 Aug 1949 (ICRC official edition) | 1949 (2012 printing) | ICRC | Verified 200 (icrc.org direct) | Same ICRC terms as B3 | 224 pp / 1.69 MB |
| B5 | CCHN Field Manual on Frontline Humanitarian Negotiation | v2.0, Nov 2019 | CCHN, Geneva | Verified 200 (frontline-negotiations.org direct) | **Permission required** (quoted below) | 156 pp / 11 MB |
| B6 | UNHCR Handbook on Procedures and Criteria for Determining Refugee Status | reissued Feb 2019 (orig. 1979) | UNHCR | Verified 200 (via Wayback; direct unhcr.org WAF-blocked) | **All rights reserved** | 278 pp / 2.35 MB |

**B1–B2 (public domain).** `unhcr.org` and `refworld.org` are both WAF-gated to non-browser clients — `web.archive.org/web/2024/<url>` reliably mirrors the same UNHCR PDFs and returns 200; use that as the fetch path. No restrictive notice found in either document; both are UN official documents/treaty series text, which per UN copyright policy ("Official Records, United Nations documents and public information material are in the public domain") are free to use. B1 is the foundational legal definition of refugee status; B2 covers the non-refugee-displacement gap (people who never cross a border) and complements it.

**B3–B4 (ICRC, attribution-required).** Quoted from `icrc.org/en/copyright-and-terms-use`: *"Documents may be copied on condition that copyright and source indications are also copied, no modifications are made and the document is copied entirely."* Commercial use needs prior authorization — fine for RAG ingestion with attribution, not for redistribution/resale. B3 is the shortest, cleanest IHL primer for grounding basic questions; B4 is the primary treaty text itself in ICRC's own printing.

**B5 — CCHN Field Manual.** Page 5, verbatim: *"Copyright © 2019 Centre of Competence on Humanitarian Negotiation (CCHN) and Claude Bruderlein. This Manual may be reproduced in part or in total with permission from the copyright holders and proper credit included."* **Gate on permission** before ingesting/redistributing.

**B6 — UNHCR Refugee Status Handbook.** Verbatim: *"© 2019 UNHCR. All rights reserved for all countries."* (HCR/1P/4/ENG/REV.4). Confirms the project's standing concern: a UN-affiliated org's own authored guidance is **not** automatically public domain even though the treaty it interprets (B1) is — don't assume permissive licensing by association. It's also the highest-practical-value document in this set (the interpretive standard adjudicators use to apply the 1951 Convention), so worth a permission request rather than dropping outright.

---

## C. Data & evidence (highest priority — eval-flagged gap)

The eval suite failed specifically on FEWS NET background knowledge, so this
area got the deepest research pass.

| # | Document | Version/Year | Publisher | Download | License | Size |
|---|---|---|---|---|---|---|
| C1 | IPC Technical Manual | v3.1, Jul 2021 | IPC Global Partnership (FAO/WFP/FEWS NET et al.) | **Blocked** — whole `ipcinfo.org` host WAF'd, no working mirror found | UNVERIFIED | ~220 pp (unconfirmed) |
| C2 | FEWS NET Guidance Doc #1: Scenario Development for Food Security Early Warning | Jan 2018 | FEWS NET / USAID | **Verified 200**, direct | UNVERIFIED (site-level attribution norm, not doc-confirmed) | 50 pp / 1.1 MB |
| C3 | FEWS NET Guidance Doc: Matrix Analysis (integrated survey-indicator classification) | May 2021 | FEWS NET / USAID | **Verified 200**, direct | UNVERIFIED (same as C2) | 30 pp / 1.1 MB |
| C4 | ACLED Codebook | 2024 ed. (Oct 7, 2024) | ACLED | **Verified 200**, direct | **Restrictive — non-commercial only, no redistribution** (quoted below) | 42 pp / 655 KB |
| C5 | JIAF 2.0 Technical Manual | v2, Jul 2024 | IASC/OCHA | **Blocked** at every canonical/mirror host tried | UNVERIFIED | ~90–100 pp (unconfirmed) |
| C6 | Cadre Harmonisé Manual | v2.0 | CILSS | Not fetch-tested — same blocked host family as C1/C5 | UNVERIFIED | unknown |

**C1 — IPC Technical Manual v3.1.** Canonical `ipcinfo.org/fileadmin/user_upload/ipcinfo/manual/IPC_Technical_Manual_3_Final.pdf` and mirror `fscluster.org/sites/default/files/documents/ipc_technical_manual_3_final.pdf` both returned HTTP 403 — the interactive HTML manual page also 403'd, so the whole `ipcinfo.org` host is bot-walled, not just the PDF. Checked `capacity4dev.eu` (only hosts old v1.1), `openknowledge.fao.org` (403), `knowledge4policy.ec.europa.eu` (loads, but only links to v3.0 not 3.1) — no working mirror found this round. License page unreachable (also 403), so **UNVERIFIED**. **This is the single highest-value gap-filler** — the core methodology every IPC/Cadre-Harmonisé/FEWS-NET-compatible classification traces back to (phase definitions, Famine thresholds, evidence protocols) — but it needs a human/browser download, not an automated one, before it can be treated as obtained.

**C2–C3 — FEWS NET Guidance Documents.** Both fully fetched. C2 (Hillbruner & Speca, USAID contract AID-OAA-I-12-00006) covers FEWS NET's 8-step scenario-development method (baseline → assumptions → projected classification) — directly explains *how FEWS NET produces its outlooks*, distinct from IPC's own consensus process, which is exactly the conflation the eval flagged. C3 (Hillbruner, May 2021) covers the FCS/rCSI/HHS matrix method for IPC-compatible classification from household survey data. No in-document copyright/reproduction statement beyond a photo-credit line; fews.net's site-level data-attribution policy says content "may be distributed or copied freely ... with the request that FEWS NET be cited as the source," but that's scoped to the website's general data, not confirmed to cover full-text PDF redistribution — **mark UNVERIFIED for the documents themselves**, cite-with-attribution is the safe working assumption.

**C4 — ACLED Codebook 2024.** Verified live and fully read (event/actor typology, sourcing methodology, source-scale coding). License confirmed **restrictive** per `acleddata.com/eula`: *"royalty-free, non-exclusive, non-transferable, non-sublicensable license ... for non-commercial purposes"*; *"Commercial entities may not access or use the Content ... without first obtaining a corporate license"*; *"Licensee is not permitted to reproduce, republish, redistribute, or create derivative works from any of ACLED's Analysis"*; anti-scraping clause. **Flag for legal review before ingestion** — do not assume a research-use exemption applies.

**C5 — JIAF 2.0 Technical Manual.** Every canonical/mirror host blocked: `interagencystandingcommittee.org`, `unocha.org`, `reliefweb.int`, `fscluster.org` all 403'd; `jiaf.info` returned HTTP 444 (connection reset); an `iihl.org` link resolved to a JIAF logo asset, not the manual. One partial substitute found live — a 4-page "Decoding JIAF 2.0" briefing deck at `healthcluster.who.int` — not a substitute for the full manual. Recommend a human (non-bot) download from unocha.org/reliefweb.

**C6 — Cadre Harmonisé Manual v2.0.** Found at `ipcinfo.org/.../CH_Manual_2.0_English.pdf` and a v1.0 mirror at `fscluster.org` — both hosts already confirmed WAF-blocked twice over (C1, C5), so not spent fetch budget re-confirming. Treat as likely blocked; needs human verification. Lower priority — explicitly optional/backup per the research brief, and IPC/FEWS NET material was not thin enough to need it.

---

## D. AI governance for the humanitarian sector

Genuinely thin area — 5 real candidates found, reported honestly rather than padded.

| # | Document | Year | Publisher | Download | License | Size |
|---|---|---|---|---|---|---|
| D1 | The Signal Code: A Human Rights Approach to Information During Crisis | 2017 | Signal Program / Harvard Humanitarian Initiative | Verified 200 (ReliefWeb mirror; `hhi.harvard.edu` and `signalcode.org` both dead/blocked) | UNVERIFIED (PDF xref malformed, unparseable by automated tools) | 2.7 MB, pages unknown |
| D2 | AI and machine learning in armed conflict: A human-centred approach | 2019 | ICRC | Verified 200 (icrc.org direct) | Attribution-required, non-commercial (same ICRC terms as B3/B4) | 589 KB / 12 pp |
| D3 | SAFE AI: Governance Framework for Humanitarians using AI, v1.2 | 2026 | CDAC Network / Alan Turing Institute / Humanitarian AI Advisory | Verified 200 (Zenodo, DOI 10.5281/zenodo.22080937) | **CC BY 4.0** (explicit) | ~1.3 MB |
| D4 | Briefing Note on Artificial Intelligence and the Humanitarian Sector | Apr 2024 | OCHA Centre for Humanitarian Data | Verified 200 (data.humdata.org direct) | CC BY 4.0 (site-level policy; not embedded per-doc) | 999 KB / 8 pp |
| D5 | UNHCR AI Approach | Sept 2025 | UNHCR | **Blocked** — Cloudflare WAF confirmed 3 ways (WebFetch, curl w/ browser UA, jina.ai reader proxy) | Not verifiable | unknown |

**D1 — The Signal Code.** URL `reliefweb.int/attachments/ddebec31-fb6f-3666-98af-034981c7e050/signalcode_final7.pdf`, valid PDF header, 2.7 MB. `hhi.harvard.edu` itself is Akamai-WAF-blocked (403 via curl too); `signalcode.org` is now a dead WordPress "Private Site"; `dtm.iom.int` mirror also 403s. The PDF's internal xref table is malformed — `pdftotext`/`pdfinfo`/`pypdf` all fail to parse it, so license text could not be automatically extracted. **UNVERIFIED — do not assume permissive** on the strength of it being a rights-based academic framework. Why it matters: the normative anchor (Right to Information, Protection, Privacy/Security, Data Agency, Rectification/Redress) that later work including D3 explicitly builds on.

**D2 — ICRC AI/ML in armed conflict (2019).** Confirmed 200, real PDF, 12 pp, dated Geneva, 6 June 2019. Same ICRC terms as B3/B4 (verbatim-attribution, non-commercial, no modification). Most authoritative single humanitarian-sector statement on AI ethics/legal obligations found in this pass.

**D3 — CDAC SAFE AI Governance Framework v1.2 (2026).** Confirmed via Zenodo. License explicitly stated on the CDAC resource page: *"Both works are licensed under CC BY 4.0."* Funded by UK International Development. Cleanest license in this whole research round alongside A1 — first operational, sector-wide AI governance framework purpose-built for humanitarians (risk-tiered governance depth, "community-in-the-loop" requirement).

**D4 — OCHA AI Briefing Note (Apr 2024).** Verified 200, genuine InDesign-produced 8-page PDF. `centre.humdata.org` states site content is *"licensed under a Creative Commons Attribution 4.0 International license"* except where noted, but this specific PDF has no embedded per-document copyright line — treat as CC BY 4.0 by site policy, not doc-confirmed. Distinct from the IASC Data Responsibility guidance already in `SOURCES.md` — this is the AI/algorithmic-systems-specific supplement (misinformation, bias, opacity, cybersecurity, privacy erosion risks, concrete sector use cases).

**D5 — UNHCR AI Approach (Sept 2025).** URL found (`unhcr.org/digitalstrategy/wp-content/uploads/sites/161/2025/09/UNHCR-AI-Approach-Sept25-Final.pdf`) but confirmed blocked three independent ways (WebFetch 403, curl w/ browser UA → `cf-mitigated: challenge`, jina.ai reader proxy → literal bot-check interstitial). No mirror found on ReliefWeb/Refworld this pass. Flag for a manual/browser-based retry rather than treating as permanently unavailable.

---

## Recommended Phase-C1 shortlist

Per the brief: areas **A + C**, ~5–7 documents, weighted toward verified license,
direct download, and the FEWS NET/IPC eval-gap priority.

| Priority | Doc | Area | License | Download status | Action |
|---|---|---|---|---|---|
| 1 | FEWS NET Scenario Development Guidance (2018) | C2 | UNVERIFIED, low-risk attribution norm | **Fetchable now** | Ingest — closes the exact eval-flagged gap |
| 2 | FEWS NET Matrix Analysis Guidance (2021) | C3 | UNVERIFIED, low-risk attribution norm | **Fetchable now** | Ingest — same gap, complementary method |
| 3 | WHO Health Cluster Guide (2020) | A1 | **CC BY-NC-SA 3.0 IGO, confirmed** | **Fetchable now** | Ingest — cleanest license in the whole batch |
| 4 | IPC Technical Manual v3.1 | C1 | UNVERIFIED | **Blocked, needs human download** | Highest eval-gap value of anything researched — worth a manual browser fetch before the next ingestion pass; don't skip solely because it's automation-resistant |
| 5 | ACLED Codebook (2024) | C4 | **Restrictive — non-commercial, no redistribution** | Fetchable now | Hold for legal review; do not ingest until non-commercial-use compatibility with this project is confirmed |
| 6 (stretch) | JIAF 2.0 Technical Manual | C5 | UNVERIFIED | Blocked, no mirror found | Needs human download attempt; lower priority than IPC given eval focus was food-security, not JIAF specifically |

**Unobtainable this round:** IPC Technical Manual v3.1 (C1), JIAF 2.0 Technical
Manual (C5), and likely Cadre Harmonisé v2.0 (C6) — all sit behind the same
class of Cloudflare/AWS WAF as `spherestandards.org` and
`interagencystandingcommittee.org` in `SOURCES.md`. UNHCR AI Approach (D5) is
similarly blocked. None of these are dead ends — they need a human/browser
session to retrieve rather than another automated pass.

**License concerns carried forward:** LEGS Handbook (A6) is confirmed
all-rights-reserved, same pattern as Sphere — do not ingest without
permission. CCHN Field Manual (B5) and UNHCR Refugee Status Handbook (B6)
both require permission per their own copyright pages. ACLED Codebook (C4)
is non-commercial-only with an explicit no-redistribution and anti-scraping
clause. Everything marked UNVERIFIED above should be treated as
all-rights-reserved for any redistribution purpose (fine for internal RAG
indexing per the Sphere precedent's "research and programme activities"
reading, not fine for a public repo) until confirmed otherwise.
