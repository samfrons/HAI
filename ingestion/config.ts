import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const CORPUS_DIR = resolve(ROOT, 'corpus');
export const MANIFEST_PATH = resolve(ROOT, 'manifest.json');

/** Source keys must match the check constraint on public.standards_chunks.source. */
export type SourceKey =
  | 'sphere'
  | 'chs'
  | 'iasc_data_responsibility'
  | 'iasc_protection'
  | 'iasc_disability'
  | 'fews_net_scenario'
  | 'fews_net_matrix'
  | 'who_health_cluster'
  | 'data_ecosystem_hdx'
  | 'data_ecosystem_kobo'
  | 'data_ecosystem_fews_net'
  | 'data_ecosystem_wfp_scope';

export interface CorpusDoc {
  source: SourceKey;
  file: string;
  docTitle: string;
  /**
   * Short description of what the document is, used as the fallback context when
   * contextualization is skipped and as the opening line of the contextualizer
   * prompt.
   */
  blurb: string;
}

export const CORPUS: CorpusDoc[] = [
  {
    source: 'sphere',
    file: 'Sphere-Handbook-2018-EN.pdf',
    docTitle: 'The Sphere Handbook: Humanitarian Charter and Minimum Standards in Humanitarian Response (4th edition, 2018)',
    blurb:
      'The Sphere Handbook sets out the Humanitarian Charter, the Protection Principles, the Core Humanitarian Standard, and the minimum technical standards for WASH, food security and nutrition, shelter and settlement, and health in humanitarian response. Standards are stated with key actions, key indicators, and guidance notes.',
  },
  {
    source: 'chs',
    file: 'CHS-2024.pdf',
    docTitle: 'The Core Humanitarian Standard on Quality and Accountability (2024 Edition)',
    blurb:
      'The Core Humanitarian Standard describes nine commitments that organisations and individuals involved in humanitarian response can use to improve the quality and effectiveness of the assistance they provide, each with supporting key actions and organisational responsibilities.',
  },
  {
    source: 'iasc_data_responsibility',
    file: 'IASC-Data-Responsibility-2023.pdf',
    docTitle: 'IASC Operational Guidance on Data Responsibility in Humanitarian Action (2023, 2nd edition)',
    blurb:
      'This IASC operational guidance sets out how humanitarian actors should manage personal and non-personal data safely, ethically and effectively, covering data responsibility principles, system-wide and response-level actions, data incident management, and data impact assessments.',
  },
  {
    source: 'iasc_protection',
    file: 'IASC-Protection-Policy-2016.pdf',
    docTitle: 'IASC Policy on Protection in Humanitarian Action (2016)',
    blurb:
      'This IASC policy establishes the centrality of protection in humanitarian action, defining protection outcomes, the responsibilities of Humanitarian Coordinators, Humanitarian Country Teams and clusters, and how protection analysis should shape humanitarian strategy.',
  },
  {
    source: 'iasc_disability',
    file: 'IASC-Disability-Inclusion-2019.pdf',
    docTitle: 'IASC Guidelines on the Inclusion of Persons with Disabilities in Humanitarian Action (2019)',
    blurb:
      'These IASC guidelines set out how humanitarian actors should include persons with disabilities across the programme cycle, with must-do actions organised by the four programming approaches and by sector (protection, WASH, health, shelter, education, food security, camp coordination and camp management, livelihoods).',
  },
  {
    source: 'fews_net_scenario',
    file: 'FEWS-NET-Scenario-Development-2018.pdf',
    docTitle: 'FEWS NET Guidance Document: Scenario Development for Food Security Early Warning (January 2018)',
    blurb:
      'This FEWS NET guidance document sets out the eight-step scenario-development method FEWS NET analysts use to project food security outcomes: establishing a baseline, developing assumptions about the future, and analysing how those assumptions will affect the food and income sources of poor households through the outlook period.',
  },
  {
    source: 'fews_net_matrix',
    file: 'FEWS-NET-Matrix-Analysis-2021.pdf',
    docTitle: 'FEWS NET Guidance Document: Matrix Analysis — Integrated Analysis of Survey-Based Indicators for Classification of Acute Food Insecurity (May 2021)',
    blurb:
      'This FEWS NET guidance document explains the matrix method for converging household survey indicators (food consumption score, reduced coping strategies index, household hunger scale) into an IPC-compatible classification of acute food insecurity.',
  },
  {
    source: 'who_health_cluster',
    file: 'WHO-Health-Cluster-Guide-2020.pdf',
    docTitle: 'Health Cluster Guide: A Practical Handbook (WHO / Global Health Cluster, 2020)',
    blurb:
      'This WHO/Global Health Cluster handbook covers health-cluster coordination in humanitarian emergencies: cluster activation, the Humanitarian Country Team structure, needs assessment, health-sector strategy, cash-based interventions, information management, accountability to affected populations, and protection from sexual exploitation and abuse.',
  },
  {
    source: 'data_ecosystem_hdx',
    file: 'HDX-docs-2026.md',
    docTitle: 'The Humanitarian Data Exchange (HDX) — platform and API overview',
    blurb:
      'A descriptive overview of the Humanitarian Data Exchange (HDX), the OCHA-run open data-sharing platform for humanitarian data: what it hosts, how licensing and terms of use work for published datasets, and the HDX Humanitarian API (HAPI) that serves standardised indicators drawn from HDX datasets.',
  },
  {
    source: 'data_ecosystem_kobo',
    file: 'KoboToolbox-docs-2026.md',
    docTitle: 'KoboToolbox — data collection platform overview',
    blurb:
      'A descriptive overview of KoboToolbox, the data collection and management platform widely used in humanitarian and development field surveys: its documentation structure, from form design through data collection and analysis, and what is and is not confirmed about its licensing.',
  },
  {
    source: 'data_ecosystem_fews_net',
    file: 'FEWS-NET-about-2026.md',
    docTitle: 'About FEWS NET — organisation and methodology overview',
    blurb:
      "A descriptive overview of FEWS NET (the Famine Early Warning Systems Network) as an organisation: its USAID origin and oversight, its partnership model, and a summary of its scenario-development methodology, complementing the two full FEWS NET guidance documents already in this corpus.",
  },
  {
    source: 'data_ecosystem_wfp_scope',
    file: 'WFP-SCOPE-Brief-2019.pdf',
    docTitle: 'WFP SCOPE Brief (September 2019)',
    blurb:
      "This WFP brief describes SCOPE, WFP's beneficiary information and transfer management platform: beneficiary registration and biometric data, transfer management across WFP's cash, voucher and in-kind modalities, identity verification and deduplication, and the SCOPECARD family of delivery mechanisms.",
  },
];

export function docFor(source: SourceKey): CorpusDoc {
  const doc = CORPUS.find((d) => d.source === source);
  if (!doc) throw new Error(`unknown source: ${source}`);
  return doc;
}

/**
 * Read env from ingestion/.env, falling back to app/.env.local so a developer
 * who already configured the Next.js app does not have to duplicate keys.
 * Real process env always wins.
 */
function loadDotEnvFiles(): void {
  const candidates = [resolve(ROOT, '.env'), resolve(ROOT, '..', 'app', '.env.local')];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value && process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadDotEnvFiles();

export const env = {
  /** Local Ollama server; nothing in this pipeline calls a paid API. */
  ollamaBaseUrl: (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/+$/, ''),
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'mxbai-embed-large',
  contextModel: process.env.CONTEXT_MODEL ?? 'qwen2.5:14b',
  /** Escape hatch: run the pipeline with context_summary = '' throughout. */
  skipContextualize: /^(1|true|yes)$/i.test(process.env.SKIP_CONTEXTUALIZE ?? ''),
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

/** Reports which settings are present without ever printing a key's value. */
export function credentialReport(): Record<string, boolean | string> {
  return {
    OLLAMA_BASE_URL: env.ollamaBaseUrl,
    EMBEDDING_MODEL: env.embeddingModel,
    CONTEXT_MODEL: env.contextModel,
    SUPABASE_URL: Boolean(env.supabaseUrl),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(env.supabaseServiceRoleKey),
  };
}
