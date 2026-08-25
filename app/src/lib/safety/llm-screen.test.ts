import { beforeAll, describe, expect, it } from 'vitest';

import { isLlmScreenEnabled, llmScreen } from './llm-screen';

describe('isLlmScreenEnabled', () => {
  it('is off unless the flag is exactly "true"', () => {
    const original = process.env.PII_LLM_SCREEN;
    try {
      delete process.env.PII_LLM_SCREEN;
      expect(isLlmScreenEnabled()).toBe(false);
      process.env.PII_LLM_SCREEN = '1';
      expect(isLlmScreenEnabled()).toBe(false);
      process.env.PII_LLM_SCREEN = 'true';
      expect(isLlmScreenEnabled()).toBe(true);
    } finally {
      if (original === undefined) delete process.env.PII_LLM_SCREEN;
      else process.env.PII_LLM_SCREEN = original;
    }
  });
});

describe('llmScreen when disabled', () => {
  it('returns nothing without touching the network', async () => {
    const original = process.env.PII_LLM_SCREEN;
    delete process.env.PII_LLM_SCREEN;
    try {
      await expect(llmScreen('Grace Achieng said the water point is broken.')).resolves.toBe(
        undefined,
      );
    } finally {
      if (original !== undefined) process.env.PII_LLM_SCREEN = original;
    }
  });
});

/**
 * Live smoke test against whatever LLM_BASE_URL points at. Skipped unless the
 * feature is switched on, so a normal `pnpm test` never depends on a running
 * model server.
 *
 *   PII_LLM_SCREEN=true pnpm test
 */
describe.skipIf(process.env.PII_LLM_SCREEN !== 'true')('llmScreen against a live model', () => {
  beforeAll(() => {
    // The production default gives up after 8s so the user is not left waiting.
    // A local 14B on a loaded developer machine needs far longer, and here we
    // are testing the verdicts rather than the latency.
    process.env.PII_SCREEN_TIMEOUT_MS = '120000';
  });

  it('catches a personal name the regexes cannot see', async () => {
    const finding = await llmScreen(
      'Help me write up the feedback from Grace Achieng about the broken water point in her block.',
    );
    expect(finding?.type).toBe('identifier');
    expect(JSON.stringify(finding)).not.toContain('Grace');
  }, 150_000);

  it('leaves a standards question alone', async () => {
    await expect(
      llmScreen('What are Sphere minimum water quantities per person per day?'),
    ).resolves.toBe(undefined);
  }, 150_000);

  it('leaves aggregate figures alone', async () => {
    await expect(
      llmScreen(
        'The World Food Programme reached 45,000 households across Dadaab and Kakuma in June.',
      ),
    ).resolves.toBe(undefined);
  }, 150_000);
});
