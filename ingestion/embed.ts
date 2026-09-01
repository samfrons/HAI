import { env } from './config.ts';

/**
 * Embeddings from a local Ollama server. mxbai-embed-large produces 1024
 * dimensions, which is what standards_chunks.embedding and
 * search_standards_hybrid are declared as. Nothing here calls a paid API, so
 * there is no spend to estimate or cap -- the only budget is wall-clock time.
 */

export const EMBED_DIMENSIONS = 1024;

/**
 * mxbai-embed-large is a BERT-family model: 512 tokens is an architectural
 * limit, not a setting, and Ollama rejects a longer input outright rather than
 * truncating it. Chunk size is therefore a function of the embedding model --
 * see DEFAULT_CHUNK_OPTIONS, which sizes chunks to fit inside this window with
 * room for the context summary and section path that are embedded alongside.
 */
export const EMBED_MAX_INPUT_TOKENS = 512;

/**
 * Last-resort guard so one outlier cannot fail a whole run. Chunking should
 * already keep every input inside the window; this catches the case where the
 * character-per-token estimate was optimistic for unusually dense text.
 */
const MAX_INPUT_CHARS = Math.floor(EMBED_MAX_INPUT_TOKENS * 3.4);

let truncatedInputs = 0;

/** How many inputs the guard above had to shorten during this process. */
export function truncatedInputCount(): number {
  return truncatedInputs;
}

function fitToWindow(text: string, maxChars: number = MAX_INPUT_CHARS): string {
  if (text.length <= maxChars) return text;
  truncatedInputs++;
  // Cut at a word boundary so the tail of the vector is not a partial token.
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > maxChars * 0.8 ? cut.slice(0, lastSpace) : cut;
}

/**
 * Ollama embeds a batch sequentially inside one request, so a large batch just
 * makes a single request slow and easy to time out. 32 keeps each request
 * short enough to retry cheaply while still amortising the HTTP overhead.
 */
const BATCH_SIZE = 32;
const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 300_000;

interface OllamaEmbedResponse {
  embeddings: number[][];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function ollamaReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${env.ollamaBaseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** True when the named model is already pulled locally. */
export async function ollamaHasModel(model: string): Promise<boolean> {
  try {
    const response = await fetch(`${env.ollamaBaseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return false;
    const json = (await response.json()) as { models?: { name?: string }[] };
    // Ollama reports "mxbai-embed-large:latest" for a bare "mxbai-embed-large".
    return (json.models ?? []).some(
      (m) => m.name === model || m.name?.split(':')[0] === model.split(':')[0],
    );
  } catch {
    return false;
  }
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  // The 3.4 chars/token estimate behind MAX_INPUT_CHARS assumes English prose;
  // it undercounts tokens for symbol-dense text (the SPSS/Excel formula annex
  // in the FEWS NET matrix guidance tokenizes far denser than prose, so a
  // chunk well under the char budget still overflowed the model's 512-token
  // window). Each retry after a context-length rejection halves the char
  // budget rather than repeating the same doomed input.
  let maxChars = MAX_INPUT_CHARS;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${env.ollamaBaseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: env.embeddingModel,
          input: texts.map((t) => fitToWindow(t, maxChars)),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        if (/context length/i.test(body)) maxChars = Math.floor(maxChars / 2);
        throw new Error(`HTTP ${response.status} ${body.slice(0, 300)}`);
      }

      const json = (await response.json()) as OllamaEmbedResponse;
      if (!json.embeddings || json.embeddings.length !== texts.length) {
        throw new Error(
          `expected ${texts.length} embeddings, got ${json.embeddings?.length ?? 0}`,
        );
      }
      for (const vector of json.embeddings) {
        if (vector.length !== EMBED_DIMENSIONS) {
          throw new Error(
            `${env.embeddingModel} returned ${vector.length} dimensions, but ` +
              `standards_chunks.embedding is vector(${EMBED_DIMENSIONS})`,
          );
        }
      }
      return json.embeddings;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          `Ollama embeddings failed after ${MAX_ATTEMPTS} attempts: ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
      await sleep(2 ** attempt * 500);
    }
  }
  throw new Error('unreachable');
}

export async function embedDocuments(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    out.push(...(await embedBatch(texts.slice(i, i + BATCH_SIZE))));
    onProgress?.(out.length, texts.length);
  }
  return out;
}

/**
 * Embed a search query. mxbai-embed-large is trained with an asymmetric
 * retrieval prompt: queries carry this prefix, documents do not. Omitting it
 * measurably degrades recall, so the app must use this same function rather
 * than embedding the raw query string.
 */
export const QUERY_PREFIX =
  'Represent this sentence for searching relevant passages: ';

export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedBatch([`${QUERY_PREFIX}${text}`]);
  return embedding;
}

/**
 * The text actually sent to the embedding model. Contextual retrieval works by
 * embedding the context together with the chunk, not by storing it alongside;
 * the section path is included for the same reason.
 */
export function embeddingInput(contextSummary: string, sectionPath: string, content: string): string {
  return [contextSummary, sectionPath, content].filter(Boolean).join('\n\n');
}
