/**
 * Query embeddings for standards retrieval, from either a local or a hosted
 * provider.
 *
 * The corpus was embedded with `mxbai-embed-large` through Ollama (see
 * ingestion/embed.ts). A query vector is only comparable to those document
 * vectors if it comes out of the *same model*, so both providers here serve
 * that one model and nothing else:
 *
 *   EMBEDDINGS_PROVIDER=ollama  (default) local Ollama, free, no key
 *   EMBEDDINGS_PROVIDER=hf      Hugging Face Inference, hosted
 *
 * The Hugging Face route serves `mixedbread-ai/mxbai-embed-large-v1`, which is
 * the upstream model Ollama's `mxbai-embed-large` packages — same weights, same
 * 1024 dimensions, same vector space. A different model at the same dimension
 * count (bge-large, e5-large) would produce vectors that are the right *shape*
 * and the wrong *space*: every search would still return eight rows, ranked by
 * noise. That failure is invisible in a smoke test, which is why this module
 * takes a model name from the environment only for Ollama, where the operator
 * is choosing what they themselves ingested with.
 *
 * cost: $0.00 on the ollama path. The hf path draws on Hugging Face's free
 * monthly Inference credit (about $0.10/month for a free account at the time of
 * writing) and starts failing, not billing, when that is exhausted.
 */

const EMBED_DIMENSIONS = 1024;

/*
 * mxbai-embed-large is trained with an asymmetric retrieval prompt: queries
 * carry this prefix, documents do not (ingestion/embed.ts embedded the corpus
 * without it). Omitting it measurably degrades recall. It applies to the model,
 * not the transport, so both providers send it.
 */
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

/*
 * Raised from 15s: a concurrent eval run driving two other local models
 * (qwen2.5 + deepseek-r1) starved the Ollama endpoint enough to blow the old
 * timeout on an otherwise-healthy server. Still well under the chat route's own
 * stall timeout.
 */
const OLLAMA_TIMEOUT_MS = 20_000;

/*
 * Longer than the local budget on purpose: hf-inference unloads idle models and
 * a cold start on the first query of the day takes tens of seconds, where a warm
 * one answers in well under a second. Timing out here means the answer is
 * ungrounded, so it is worth waiting.
 */
const HF_TIMEOUT_MS = 30_000;

/** One retry, short backoff — enough to survive a transient contention spike
 * without turning a slow moment into a user-visible "retrieval unavailable". */
const RETRY_DELAY_MS = 2_000;

export type EmbeddingsProvider = 'ollama' | 'hf';

/** Reads `EMBEDDINGS_PROVIDER`; anything unrecognized falls back to local. */
export function getEmbeddingsProvider(): EmbeddingsProvider {
  return process.env.EMBEDDINGS_PROVIDER === 'hf' ? 'hf' : 'ollama';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Accepts both shapes the two APIs return: Ollama answers `{embeddings: [[…]]}`,
 * and hf-inference answers a bare `[…]` for a single input or `[[…]]` for a
 * batch. Returns null unless exactly one vector of the corpus's dimension came
 * back — a wrong-length vector means the wrong model answered, and a search run
 * against it would silently rank by noise.
 */
function toVector(payload: unknown): number[] | null {
  const candidate =
    Array.isArray(payload) && Array.isArray(payload[0])
      ? (payload[0] as unknown[])
      : Array.isArray(payload)
        ? (payload as unknown[])
        : null;

  if (!candidate || candidate.length !== EMBED_DIMENSIONS) return null;
  if (!candidate.every((value) => typeof value === 'number' && Number.isFinite(value))) {
    return null;
  }
  return candidate as number[];
}

async function fetchOllamaEmbedding(text: string): Promise<number[] | null> {
  const baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/+$/, '');
  const model = process.env.EMBEDDING_MODEL ?? 'mxbai-embed-large';

  const response = await fetch(`${baseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: [`${QUERY_PREFIX}${text}`] }),
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
  });
  if (!response.ok) return null;

  const json = (await response.json()) as { embeddings?: unknown };
  return toVector(json.embeddings);
}

/*
 * The legacy api-inference.huggingface.co host was decommissioned; the router
 * host below is the only one that resolves. The explicit `/pipeline/
 * feature-extraction` suffix is required — without it the router picks a task
 * from the model card and can answer sentence-similarity scores instead of
 * vectors.
 */
const HF_MODEL = 'mixedbread-ai/mxbai-embed-large-v1';
const HF_ENDPOINT = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`;

async function fetchHuggingFaceEmbedding(text: string): Promise<number[] | null> {
  const token = process.env.HF_TOKEN;
  if (!token) return null;

  const response = await fetch(HF_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ inputs: `${QUERY_PREFIX}${text}` }),
    signal: AbortSignal.timeout(HF_TIMEOUT_MS),
  });
  if (!response.ok) return null;

  return toVector(await response.json());
}

/**
 * Embed a search query, or return `null`.
 *
 * Never throws. `null` covers every failure — unreachable server, missing
 * token, exhausted credit, a vector of the wrong dimension — because the caller
 * can still run the full-text leg of hybrid search without a vector, and a
 * degraded search beats a failed request.
 */
export async function embedQuery(text: string): Promise<number[] | null> {
  const fetchEmbedding =
    getEmbeddingsProvider() === 'hf' ? fetchHuggingFaceEmbedding : fetchOllamaEmbedding;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const vector = await fetchEmbedding(text);
      if (vector) return vector;
    } catch {
      // fall through to retry/give-up below
    }
    if (attempt === 0) await delay(RETRY_DELAY_MS);
  }
  return null;
}
