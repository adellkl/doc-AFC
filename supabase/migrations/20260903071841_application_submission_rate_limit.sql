-- This table is deliberately kept outside the Data API. The public endpoint
-- supplies only a HMAC-SHA-256 fingerprint, never a raw client IP address.
create table private.application_submission_rate_limits (
  scope_hash text primary key check (scope_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  last_request_at timestamptz not null
);

alter table private.application_submission_rate_limits enable row level security;

revoke all on table private.application_submission_rate_limits from public;
grant usage on schema private to service_role;
grant select, insert, update, delete on table private.application_submission_rate_limits to service_role;

-- The function lives in public only so an Edge Function can call it through
-- PostgREST RPC. It runs with the caller's privileges and is callable solely
-- by service_role; anon and authenticated users cannot consume or inspect the
-- rate-limit state.
create or replace function public.enforce_application_submission_rate_limit(
  p_scope_hash text
)
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
set search_path = pg_catalog, private
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval := interval '15 minutes';
  v_max_requests constant integer := 3;
  v_window_started_at timestamptz;
  v_request_count integer;
begin
  if p_scope_hash is null or p_scope_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid rate-limit scope';
  end if;

  insert into private.application_submission_rate_limits as limits (
    scope_hash,
    window_started_at,
    request_count,
    last_request_at
  )
  values (p_scope_hash, v_now, 1, v_now)
  on conflict (scope_hash) do update
  set
    window_started_at = case
      when limits.window_started_at <= v_now - v_window then v_now
      else limits.window_started_at
    end,
    request_count = case
      when limits.window_started_at <= v_now - v_window then 1
      else limits.request_count + 1
    end,
    last_request_at = v_now
  returning
    limits.window_started_at,
    limits.request_count
  into
    v_window_started_at,
    v_request_count;

  return query
  select
    v_request_count <= v_max_requests,
    case
      when v_request_count <= v_max_requests then 0
      else greatest(
        1,
        ceil(extract(epoch from (v_window_started_at + v_window - v_now)))::integer
      )
    end;
end;
$$;

revoke all on function public.enforce_application_submission_rate_limit(text) from public;
grant execute on function public.enforce_application_submission_rate_limit(text) to service_role;

comment on table private.application_submission_rate_limits is
  'HMAC-keyed, fixed-window counters for the unauthenticated application-submission endpoint.';
comment on function public.enforce_application_submission_rate_limit(text) is
  'Service-role-only RPC. Allows at most three application submissions per HMAC key every 15 minutes.';
