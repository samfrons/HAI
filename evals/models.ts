/**
 * Recording exactly which model weights produced a report.
 *
 * A report that names "qwen2.5" and "deepseek-r1" without digests cannot be
 * re-run against the same thing six months later, and a report that trusts a
 * config file cannot tell you what actually served the requests. Both are
 * recorded: the configured name from the app's env, and Ollama's live view.
 */

import { OLLAMA_BASE_URL } from './config.ts';

interface TagEntry {
  name?: string;
  digest?: string;
  details?: { parameter_size?: string; quantization_level?: string };
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}${path}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Short digest plus parameter size for a model name, or a stated unknown.
 *
 * Ollama tags always carry a version, but env files usually name a model
 * without one ("hai-qwen2.5"), so a bare name is also matched against its
 * `:latest` tag. Reporting "digest unknown" for a model that is right there
 * would push a reader toward whatever digest is nearby, which is how a report
 * ends up naming the judge's weights as the target's.
 */
export async function describeModel(name: string): Promise<string> {
  if (!name) return 'digest unknown (no model name)';

  const tags = await getJson<{ models?: TagEntry[] }>('/api/tags');
  const entry =
    tags?.models?.find((model) => model.name === name) ??
    (name.includes(':')
      ? undefined
      : tags?.models?.find((model) => model.name === `${name}:latest`));
  if (!entry) return `digest unknown (${name} not found in ollama /api/tags)`;

  const digest = entry.digest ? entry.digest.slice(0, 12) : 'digest unknown';
  const size = entry.details?.parameter_size;
  const quant = entry.details?.quantization_level;
  return [digest, size, quant].filter(Boolean).join(', ');
}

/** Which models Ollama currently has resident — the observation, not the claim. */
export async function loadedModels(): Promise<string[]> {
  const running = await getJson<{ models?: Array<{ name?: string }> }>('/api/ps');
  return (running?.models ?? []).map((model) => model.name ?? 'unnamed');
}
