# The Humanitarian Data Exchange (HDX)

## What HDX is

The Humanitarian Data Exchange is an open platform for sharing humanitarian data, with a mission to make data easy to find and use for analysis. It is run by OCHA's Centre for Humanitarian Data. Sharing data through HDX does not imply the transfer of any rights over that data to OCHA — organisations keep ownership of what they publish.

HDX documentation organises guidance into three main areas: finding data (searching, filtering, previewing and downloading datasets), publishing data (preparing, uploading and maintaining information on the platform), and building with HDX (using APIs, creating data pipelines, and workflow integration). Support is available at hdx@un.org.

The number of datasets, organisations and locations hosted on HDX changes continuously as humanitarian organisations publish and update data; the current counts are shown live on the HDX homepage (data.humdata.org) rather than fixed here.

## Licensing and terms of use

Organisations must specify an appropriate license for all data they share publicly on HDX, and organisations are free to choose the license for their own data. Organisations may use HDX to share data originating from other sources if the applicable license allows for onward sharing. After downloading a public dataset, users must follow the applicable license when using and sharing that data — the HDX Terms of Service do not supersede or replace the license terms a contributing organisation selected for its own dataset.

## HDX HAPI (Humanitarian API)

The HDX Humanitarian API (HAPI) is described by its own documentation as "a way to access standardised indicators from multiple sources to automate workflows and visualisations." It aggregates humanitarian data from various origins into a single, unified interface, rather than requiring a user to locate and reconcile many separate HDX datasets by hand.

HAPI aims to include all data subcategories from HDX's thematic data grids. Geographically it prioritises countries that have a humanitarian response plan, while also including additional countries where data exists; coverage varies by administrative level (national, admin 1, or admin 2) depending on what the underlying sources report.

Data flows into HAPI through manual uploads, partner API submissions, and HDX-managed pipelines. Incoming information is processed to verify codes, standardise components, and produce global datasets that are published on HDX; these foundation datasets are then refined into the country-specific versions exposed through the API. Output datasets include warning and error columns for transparency: a warning typically indicates that a correction was made to the data or flags something for the user to look out for, and rows with only warnings (no errors) are considered complete and are available through the API.

Use of HAPI is governed by the separate HDX HAPI Terms of Use; the documentation itself does not carry its own content license beyond that.

---

Source: docs.humdata.org (HDX Documentation v2 — overview and "HDX Terms of Service" pages) and hdx-hapi.readthedocs.io (HAPI overview page), both official HDX/OCHA Centre for Humanitarian Data properties. Accessed 2026-09-01. Compiled here as a descriptive summary rather than a verbatim reproduction, since both sites render their text client-side and could not be captured as raw markup.
