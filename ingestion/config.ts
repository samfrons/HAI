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
  | 'iasc_disability';

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
