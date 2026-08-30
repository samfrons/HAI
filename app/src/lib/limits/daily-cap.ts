/**
 * A hard daily ceiling on requests served by a hosted deployment.
 *
 * The per-IP limiter in the chat route lives in process memory, so on Vercel it
 * is per serverless instance and resets on every deploy: it stops one impatient
 * browser, not a bill. This one is a single counter in Postgres that every
 * instance increments through the same row lock (see
 * supabase/migrations/*_daily_request_cap.sql), which makes it the control that
 * actually bounds a day's worth of hosted inference.
 *
 * HAI's hosted stack is free-tier by design, so today this caps nothing that
 * costs money. It exists because free tiers get withdrawn, re-priced, and
 * converted to paid overage without asking, and a public demo should not be one
 * pricing-page change away from an unbounded bill.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { isLocalInference } from '@/lib/llm/provider';

const DEFAULT_MAX_DAILY_REQUESTS = 500;

export interface DailyCapResult {
  allowed: boolean;
  /** Requests counted against today's budget, including this one when allowed. */
  used: number;
  /** The ceiling that was applied. */
  cap: number;
}

/**
 * Parses `MAX_DAILY_REQUESTS`; a missing or malformed value yields the default.
 *
 * Strict rather than `parseInt`, which reads "12.9.4" as 12 and "500 per day" as
 * 500 — quietly enforcing a number the operator never chose. A dashboard field
 * that does not parse should land on the documented default, where it can be
 * recognised, not on a plausible-looking accident.
 */
export function getMaxDailyRequests(): number {
  const raw = process.env.MAX_DAILY_REQUESTS?.trim();
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_MAX_DAILY_REQUESTS;

  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) ? parsed : DEFAULT_MAX_DAILY_REQUESTS;
}

/**
 * Whether the cap applies at all.
 *
 * Local inference is free and unmetered, so a shared daily ceiling there is pure
 * friction — it would cap a workshop demo, a local eval run, and `pnpm dev` for
 * no benefit. Setting MAX_DAILY_REQUESTS explicitly turns it on anyway, which is
 * how the enforcement path gets exercised locally before it is trusted in
 * production.
 */
export function isDailyCapEnforced(): boolean {
  return !isLocalInference() || Boolean(process.env.MAX_DAILY_REQUESTS);
}

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

/** Test seam — the module-level client would otherwise outlive a stubbed env. */
export function resetDailyCapClient(): void {
  cachedClient = null;
}

interface ClaimRow {
  allowed: boolean;
  used: number;
  cap: number;
}

/**
 * Claim one request against today's budget.
 *
 * Fails **open**: an unconfigured or unreachable database returns `allowed`,
 * because the alternative is that a transient Postgres blip takes the whole
 * assistant offline to protect a budget that is not being spent. That is a real
 * gap and worth naming — if the database is down, this ceiling is not being
 * enforced. What still bounds the day in that window is the upstream provider's
 * own free-tier quota, which is a hard stop rather than an overage.
 */
export async function claimDailyRequest(): Promise<DailyCapResult> {
  const cap = getMaxDailyRequests();

  if (!isDailyCapEnforced()) {
    return { allowed: true, used: 0, cap };
  }

  const client = getClient();
  if (!client) return { allowed: true, used: 0, cap };

  try {
    const { data, error } = await client.rpc('claim_daily_request', {
      max_requests: cap,
    });
    if (error) return { allowed: true, used: 0, cap };

    const row = (Array.isArray(data) ? data[0] : data) as ClaimRow | undefined;
    if (!row || typeof row.allowed !== 'boolean') {
      return { allowed: true, used: 0, cap };
    }

    return { allowed: row.allowed, used: row.used ?? 0, cap: row.cap ?? cap };
  } catch {
    return { allowed: true, used: 0, cap };
  }
}

/**
 * Written to be read by someone who came to try the demo, not by an operator:
 * it says the limit is the demo's, not theirs, and points at the way to get an
 * unlimited one. Nothing here is an apology for a fault, because nothing faulted.
 */
export function dailyCapMessage(result: DailyCapResult): string {
  return `This public demo has reached its daily limit of ${result.cap} messages, which keeps it running on free infrastructure. It resets at 00:00 UTC. You can run HAI locally with no limit at all — the setup is in the README, and local mode runs entirely on your own machine.`;
}
