import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: rpcMock }),
}));

import {
  claimDailyRequest,
  dailyCapMessage,
  getMaxDailyRequests,
  isDailyCapEnforced,
  resetDailyCapClient,
} from './daily-cap';

const HOSTED_LLM = 'https://api.groq.com/openai/v1';

/** Minimum env for the cap to actually reach the database. */
function stubHostedDeployment(): void {
  vi.stubEnv('LLM_BASE_URL', HOSTED_LLM);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
}

beforeEach(() => {
  rpcMock.mockReset();
  resetDailyCapClient();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getMaxDailyRequests', () => {
  it('defaults to 500 when unset', () => {
    vi.stubEnv('MAX_DAILY_REQUESTS', '');
    expect(getMaxDailyRequests()).toBe(500);
  });

  it('reads a configured value', () => {
    vi.stubEnv('MAX_DAILY_REQUESTS', '25');
    expect(getMaxDailyRequests()).toBe(25);
  });

  it('honours an explicit zero as "closed"', () => {
    vi.stubEnv('MAX_DAILY_REQUESTS', '0');
    expect(getMaxDailyRequests()).toBe(0);
  });

  // A typo in a dashboard field must not silently remove the ceiling it was
  // meant to set, so anything unparseable falls back to the documented default
  // rather than to "unlimited".
  it.each(['abc', '-5', '12.9.4'])('falls back to the default for %o', (value) => {
    vi.stubEnv('MAX_DAILY_REQUESTS', value);
    expect(getMaxDailyRequests()).toBe(500);
  });
});

describe('isDailyCapEnforced', () => {
  it('is off for local inference with no explicit setting', () => {
    vi.stubEnv('LLM_BASE_URL', 'http://localhost:11434/v1');
    vi.stubEnv('MAX_DAILY_REQUESTS', '');
    expect(isDailyCapEnforced()).toBe(false);
  });

  it('is on for a hosted endpoint', () => {
    vi.stubEnv('LLM_BASE_URL', HOSTED_LLM);
    vi.stubEnv('MAX_DAILY_REQUESTS', '');
    expect(isDailyCapEnforced()).toBe(true);
  });

  it('can be turned on locally to exercise the enforcement path', () => {
    vi.stubEnv('LLM_BASE_URL', 'http://127.0.0.1:11434/v1');
    vi.stubEnv('MAX_DAILY_REQUESTS', '5');
    expect(isDailyCapEnforced()).toBe(true);
  });
});

describe('claimDailyRequest', () => {
  it('allows a request under the cap and reports usage', async () => {
    stubHostedDeployment();
    rpcMock.mockResolvedValue({ data: [{ allowed: true, used: 12, cap: 500 }], error: null });

    expect(await claimDailyRequest()).toEqual({ allowed: true, used: 12, cap: 500 });
  });

  it('blocks once the database says the budget is gone', async () => {
    stubHostedDeployment();
    rpcMock.mockResolvedValue({ data: [{ allowed: false, used: 500, cap: 500 }], error: null });

    expect(await claimDailyRequest()).toMatchObject({ allowed: false, used: 500 });
  });

  it('passes the configured cap to the RPC', async () => {
    stubHostedDeployment();
    vi.stubEnv('MAX_DAILY_REQUESTS', '42');
    rpcMock.mockResolvedValue({ data: [{ allowed: true, used: 1, cap: 42 }], error: null });

    await claimDailyRequest();

    expect(rpcMock).toHaveBeenCalledWith('claim_daily_request', { max_requests: 42 });
  });

  it('does not touch the database when the cap is not enforced', async () => {
    vi.stubEnv('LLM_BASE_URL', 'http://localhost:11434/v1');
    vi.stubEnv('MAX_DAILY_REQUESTS', '');

    expect(await claimDailyRequest()).toMatchObject({ allowed: true });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  // Fails open by design — see the note on claimDailyRequest. These pin that
  // decision so it cannot be reversed by accident.
  it('allows the request when the RPC errors', async () => {
    stubHostedDeployment();
    rpcMock.mockResolvedValue({ data: null, error: { message: 'statement timeout' } });

    expect(await claimDailyRequest()).toMatchObject({ allowed: true });
  });

  it('allows the request when the RPC throws', async () => {
    stubHostedDeployment();
    rpcMock.mockRejectedValue(new Error('ECONNRESET'));

    expect(await claimDailyRequest()).toMatchObject({ allowed: true });
  });

  it('allows the request when the RPC returns an unexpected shape', async () => {
    stubHostedDeployment();
    rpcMock.mockResolvedValue({ data: [{ unexpected: true }], error: null });

    expect(await claimDailyRequest()).toMatchObject({ allowed: true });
  });

  it('allows the request when Supabase is unconfigured', async () => {
    vi.stubEnv('LLM_BASE_URL', HOSTED_LLM);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_ANON_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');

    expect(await claimDailyRequest()).toMatchObject({ allowed: true });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('reads a single-object RPC response as well as an array', async () => {
    stubHostedDeployment();
    rpcMock.mockResolvedValue({ data: { allowed: false, used: 7, cap: 7 }, error: null });

    expect(await claimDailyRequest()).toEqual({ allowed: false, used: 7, cap: 7 });
  });
});

describe('dailyCapMessage', () => {
  it('names the cap and the way around it, without reading as an error', () => {
    const message = dailyCapMessage({ allowed: false, used: 500, cap: 500 });

    expect(message).toContain('500');
    expect(message).toContain('00:00 UTC');
    expect(message).toMatch(/locally/i);
  });
});
