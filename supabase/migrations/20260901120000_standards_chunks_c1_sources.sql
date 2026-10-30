-- Phase C1 corpus expansion: add source keys for the FEWS NET, WHO Health
-- Cluster and WFP SCOPE documents, and a new 'data_ecosystem' family covering
-- the humanitarian data-ecosystem "about"/documentation pages (HDX, Kobo,
-- FEWS NET as an organisation) added to close the eval-flagged gap on
-- humanitarian platforms and datasets.
--
-- The 'data_ecosystem_*' keys already work with the existing family-prefix
-- match in search_standards_hybrid() (20260825140000_filter_source_family.sql):
-- 'c.source like b.src || '\_%'' matches any key starting with
-- 'data_ecosystem_', so filter_source = 'data_ecosystem' groups all of them
-- without any change to that function. 'fews_net' likewise already groups
-- 'fews_net_scenario' and 'fews_net_matrix'.
--
-- Postgres has no ALTER CONSTRAINT for a check clause: drop and recreate.

alter table public.standards_chunks
  drop constraint standards_chunks_source_check;

alter table public.standards_chunks
  add constraint standards_chunks_source_check check (
    source in (
      'sphere',
      'chs',
      'iasc_data_responsibility',
      'iasc_protection',
      'iasc_disability',
      'fews_net_scenario',
      'fews_net_matrix',
      'who_health_cluster',
      'data_ecosystem_hdx',
      'data_ecosystem_kobo',
      'data_ecosystem_fews_net',
      'data_ecosystem_wfp_scope'
    )
  );
