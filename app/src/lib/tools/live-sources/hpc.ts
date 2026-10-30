// cost: free public API — UN OCHA HPC.tools / FTS. No key, no per-call charge.
//
// Ported from claude/platform-features-data-depth-euiakz (src/hai/connectors/hpc.py).

const PLANS_URL = 'https://api.hpc.tools/v2/public/plan';
const FTS_PLAN_URL = 'https://api.hpc.tools/v1/public/fts/flow';
const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = 'HAI/1.0 (humanitarian operations assistant)';

/** Plan rosters and funding totals move slowly; this is a burst guard. */
const CACHE_TTL_MS = 300_000;

export interface ResponsePlan {
  source: 'OCHA HPC';
  id: number | null;
  name: string | null;
  code: string | null;
  start: string | null;
  end: string | null;
}

export interface PlanFunding {
  source: 'OCHA FTS';
  planId: number;
  fundingUsd: number | null;
  pledgesUsd: number | null;
  flowCount: number;
}

interface HpcPlan {
  id?: number;
  name?: string;
  planVersion?: {
    name?: string;
    code?: string;
    startDate?: string;
    endDate?: string;
  };
}

interface FtsFlowResponse {
  data?: {
    incoming?: { fundingTotal?: number | null; pledgeTotal?: number | null };
    flows?: unknown[];
  };
}

const plansCache = new Map<string, { expiresAt: number; value: ResponsePlan[] }>();
const fundingCache = new Map<string, { expiresAt: number; value: PlanFunding }>();

function readCache<T>(cacheMap: Map<string, { expiresAt: number; value: T }>, key: string): T | undefined {
  const hit = cacheMap.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cacheMap.delete(key);
    return undefined;
  }
  return hit.value;
}

export function normalizePlans(data: { data?: HpcPlan[] }): ResponsePlan[] {
  return (data.data ?? []).map((plan) => ({
    source: 'OCHA HPC' as const,
    id: plan.id ?? null,
    name: plan.planVersion?.name ?? plan.name ?? null,
    code: plan.planVersion?.code ?? null,
    start: plan.planVersion?.startDate ?? null,
    end: plan.planVersion?.endDate ?? null,
  }));
}

/** Humanitarian response plans for a year. */
export async function fetchPlans(year: number): Promise<ResponsePlan[]> {
  const cacheKey = String(year);
  const cached = readCache(plansCache, cacheKey);
  if (cached) return cached;

  const response = await fetch(`${PLANS_URL}?year=${encodeURIComponent(year)}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`OCHA HPC plans API returned ${response.status}`);
  }

  const plans = normalizePlans(await response.json());
  plansCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: plans });
  return plans;
}

export function normalizePlanFunding(data: FtsFlowResponse, planId: number): PlanFunding {
  const incoming = data.data?.incoming ?? {};
  return {
    source: 'OCHA FTS',
    planId,
    fundingUsd: incoming.fundingTotal ?? null,
    pledgesUsd: incoming.pledgeTotal ?? null,
    flowCount: data.data?.flows?.length ?? 0,
  };
}

/** Funding flows summary for one response plan (FTS). */
export async function fetchPlanFunding(planId: number): Promise<PlanFunding> {
  const cacheKey = String(planId);
  const cached = readCache(fundingCache, cacheKey);
  if (cached) return cached;

  const response = await fetch(`${FTS_PLAN_URL}?planId=${encodeURIComponent(planId)}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`OCHA FTS API returned ${response.status} for plan ${planId}`);
  }

  const funding = normalizePlanFunding(await response.json(), planId);
  fundingCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: funding });
  return funding;
}
