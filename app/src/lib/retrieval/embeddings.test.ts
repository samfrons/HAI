import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { embedQuery, getEmbeddingsProvider } from './embeddings';

const DIMENSIONS = 1024;
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

function vector(fill = 0.1): number[] {
  return Array.from({ length: DIMENSIONS }, () => fill);
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

/** The module retries once with a 2s backoff; fake timers keep that instant. */
async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('getEmbeddingsProvider', () => {
  it('defaults to ollama when unset', () => {
    vi.stubEnv('EMBEDDINGS_PROVIDER', '');
    expect(getEmbeddingsProvider()).toBe('ollama');
  });

  it('selects hf only on an exact match', () => {
    vi.stubEnv('EMBEDDINGS_PROVIDER', 'hf');
    expect(getEmbeddingsProvider()).toBe('hf');
  });

  // A typo must not silently route a hosted deployment at a localhost server
  // that is not there; falling back to the documented default is the behaviour
  // an operator can debug from the logs.
  it('falls back to ollama on an unrecognized value', () => {
    vi.stubEnv('EMBEDDINGS_PROVIDER', 'huggingface');
    expect(getEmbeddingsProvider()).toBe('ollama');
  });
});

describe('embedQuery via ollama', () => {
  beforeEach(() => {
    vi.stubEnv('EMBEDDINGS_PROVIDER', 'ollama');
    vi.stubEnv('OLLAMA_BASE_URL', 'http://localhost:11434');
  });

  it('posts the prefixed query to /api/embed and returns the vector', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ embeddings: [vector()] }));

    const result = await runWithTimers(embedQuery('litres of water per person'));

    expect(result).toHaveLength(DIMENSIONS);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/embed');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'mxbai-embed-large',
      input: [`${QUERY_PREFIX}litres of water per person`],
    });
  });

  it('strips a trailing slash from the base URL', async () => {
    vi.stubEnv('OLLAMA_BASE_URL', 'http://localhost:11434/');
    fetchMock.mockResolvedValue(jsonResponse({ embeddings: [vector()] }));

    await runWithTimers(embedQuery('q'));

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/api/embed');
  });
});

describe('embedQuery via hugging face', () => {
  beforeEach(() => {
    vi.stubEnv('EMBEDDINGS_PROVIDER', 'hf');
    vi.stubEnv('HF_TOKEN', 'hf_test_token');
  });

  it('posts the prefixed query to the router feature-extraction endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse(vector()));

    const result = await runWithTimers(embedQuery('litres of water per person'));

    expect(result).toHaveLength(DIMENSIONS);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://router.huggingface.co/hf-inference/models/mixedbread-ai/mxbai-embed-large-v1/pipeline/feature-extraction',
    );
    expect(init.headers.authorization).toBe('Bearer hf_test_token');
    expect(JSON.parse(init.body)).toEqual({
      inputs: `${QUERY_PREFIX}litres of water per person`,
    });
  });

  // hf-inference answers a bare number[] for one input and number[][] for a
  // batch; the client must read both rather than depending on which it gets.
  it('accepts a nested single-vector response', async () => {
    fetchMock.mockResolvedValue(jsonResponse([vector()]));

    expect(await runWithTimers(embedQuery('q'))).toHaveLength(DIMENSIONS);
  });

  it('returns null without calling the API when HF_TOKEN is missing', async () => {
    vi.stubEnv('HF_TOKEN', '');
    fetchMock.mockResolvedValue(jsonResponse(vector()));

    expect(await runWithTimers(embedQuery('q'))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send an Ollama-shaped request', async () => {
    fetchMock.mockResolvedValue(jsonResponse(vector()));

    await runWithTimers(embedQuery('q'));

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('model');
  });
});

describe('embedQuery failure handling', () => {
  beforeEach(() => {
    vi.stubEnv('EMBEDDINGS_PROVIDER', 'ollama');
  });

  it('retries once and succeeds on the second attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(null, false))
      .mockResolvedValueOnce(jsonResponse({ embeddings: [vector()] }));

    expect(await runWithTimers(embedQuery('q'))).toHaveLength(DIMENSIONS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null after two failures rather than throwing', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    expect(await runWithTimers(embedQuery('q'))).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // A vector of the wrong length means a different model answered. Accepting it
  // would rank the whole corpus by noise while looking entirely healthy, so it
  // is treated as a failure.
  it('rejects a vector of the wrong dimension', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ embeddings: [Array(768).fill(0.1)] }));

    expect(await runWithTimers(embedQuery('q'))).toBeNull();
  });

  it('rejects a vector containing non-numeric values', async () => {
    const corrupt = vector();
    corrupt[7] = 'NaN' as unknown as number;
    fetchMock.mockResolvedValue(jsonResponse({ embeddings: [corrupt] }));

    expect(await runWithTimers(embedQuery('q'))).toBeNull();
  });
});
