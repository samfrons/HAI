-- Deployment-wide daily request cap for the hosted demo.
--
-- The app's other limiter is a per-IP sliding window held in process memory. On
-- Vercel that is per serverless instance, so the effective per-IP limit is the
-- configured one multiplied by however many instances are live, and it resets on
-- every deploy. It is a politeness control, not a spend control.
--
-- This table is the spend control: one shared counter, in one place, that every
-- instance increments through the same row lock. HAI's hosted inference runs on
-- free tiers, but free tiers are withdrawn, re-priced, and silently converted to
-- paid overage — so the public demo holds a hard ceiling of its own rather than
-- trusting an upstream provider to stay free.

create table public.daily_usage (
  -- One row per UTC day. `current_date` is evaluated on the database, so the
  -- rollover does not drift with whatever timezone a serverless instance
  -- happens to boot in.
  day date primary key default current_date,
  request_count integer not null default 0,

  constraint daily_usage_count_non_negative check (request_count >= 0)
);

comment on table public.daily_usage is
  'One row per UTC day counting chat requests served, enforcing MAX_DAILY_REQUESTS across all serverless instances. Written only through claim_daily_request().';

alter table public.daily_usage enable row level security;

-- No policies, and no grants to anon/authenticated: the counter is reachable
-- only through the security-definer function below. A client that could write
-- this table directly could zero the very thing that caps spend, and a client
-- that could read it learns nothing useful.
revoke all on public.daily_usage from anon, authenticated;

/*
 * Claim one request against today's budget, atomically.
 *
 * The whole check-and-increment is a single statement so that concurrent
 * instances cannot both read "499 used" and both proceed. The row lock taken by
 * ON CONFLICT DO UPDATE serializes them; the WHERE on the update is what makes
 * the cap hold, because a conflicting insert whose update is filtered out
 * returns no row at all — which is the signal that the budget is gone. A request
 * over the cap therefore does not increment the counter either, so an abusive
 * client cannot inflate the number that a dashboard would later be read from.
 *
 * security definer because the calling role has no rights on the table by
 * design; search_path is pinned empty and every name is schema-qualified.
 */
create or replace function public.claim_daily_request(max_requests integer default 500)
returns table (allowed boolean, used integer, cap integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap integer := greatest(coalesce(max_requests, 500), 0);
  v_used integer;
begin
  -- A cap of zero means "closed today". Handled before the insert because
  -- ON CONFLICT's WHERE only guards the *update* path: the first request of a
  -- new day inserts rather than conflicting, and would otherwise be let through.
  if v_cap = 0 then
    select d.request_count into v_used
    from public.daily_usage d
    where d.day = current_date;

    return query select false, coalesce(v_used, 0), v_cap;
    return;
  end if;

  insert into public.daily_usage as u (day, request_count)
  values (current_date, 1)
  on conflict (day) do update
    set request_count = u.request_count + 1
    where u.request_count < v_cap
  returning u.request_count into v_used;

  if v_used is null then
    -- The update was filtered out: today's row is already at the cap.
    select d.request_count into v_used
    from public.daily_usage d
    where d.day = current_date;

    return query select false, coalesce(v_used, v_cap), v_cap;
  else
    return query select true, v_used, v_cap;
  end if;
end;
$$;

comment on function public.claim_daily_request is
  'Atomically increments today''s request counter if it is below max_requests. Returns allowed=false without incrementing once the cap is reached.';

-- Explicit grants rather than inherited defaults: recent Supabase CLI versions
-- no longer expose objects that `postgres` creates in `public` to the Data API
-- roles automatically.
revoke all on function public.claim_daily_request(integer) from public;
grant execute on function public.claim_daily_request(integer) to anon, authenticated, service_role;

/*
 * Old rows are one date and one integer each — 365 rows a year, so there is no
 * retention job here on purpose. They are the only usage history the deployment
 * keeps, and they contain nothing about who made the requests.
 */
