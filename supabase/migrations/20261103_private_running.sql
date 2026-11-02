-- Apply to the owner's Supabase project. Never apply against an unrelated shared database.
begin;
create table public.eqfit_runs (
  owner_id uuid not null references auth.users(id) on delete cascade,
  garmin_id text not null check (garmin_id ~ '^[1-9][0-9]{0,29}$'),
  csv_row jsonb not null check (jsonb_typeof(csv_row) = 'array' and jsonb_array_length(csv_row) = 8),
  updated_at timestamptz not null default now(),
  primary key (owner_id, garmin_id)
);
create table public.eqfit_sync_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  last_success timestamptz,
  last_full_sync timestamptz,
  last_attempt timestamptz not null default now(),
  status text not null check (status in ('ok', 'failed'))
);
alter table public.eqfit_runs enable row level security;
alter table public.eqfit_sync_state enable row level security;
revoke all on public.eqfit_runs, public.eqfit_sync_state from anon, authenticated;
grant select on public.eqfit_runs, public.eqfit_sync_state to authenticated;
grant all on public.eqfit_runs, public.eqfit_sync_state to service_role;
create policy owner_reads_runs on public.eqfit_runs for select to authenticated using ((select auth.uid()) = owner_id);
create policy owner_reads_sync on public.eqfit_sync_state for select to authenticated using ((select auth.uid()) = owner_id);

-- One snapshot prevents mixing records and a success timestamp from different syncs.
create function public.eqfit_snapshot() returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(csv_row order by garmin_id) from public.eqfit_runs where owner_id = (select auth.uid())), '[]'::jsonb),
    'state', (select to_jsonb(s) - 'owner_id' from public.eqfit_sync_state s where owner_id = (select auth.uid()))
  );
$$;
revoke all on function public.eqfit_snapshot() from public, anon;
grant execute on function public.eqfit_snapshot() to authenticated;

-- Service-only writer. Upserts and successful cursor advancement are one transaction.
create function public.eqfit_commit_sync(p_owner uuid, p_rows jsonb, p_full boolean) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 15000 then raise exception 'Invalid sync payload'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 0));
  insert into public.eqfit_runs(owner_id, garmin_id, csv_row)
    select p_owner, r->>6, r from jsonb_array_elements(p_rows) as r
    on conflict (owner_id, garmin_id) do update set csv_row = excluded.csv_row, updated_at = now()
    where eqfit_runs.csv_row is distinct from excluded.csv_row;
  insert into public.eqfit_sync_state(owner_id, last_success, last_full_sync, last_attempt, status)
    values (p_owner, now(), case when p_full then now() else null end, now(), 'ok')
    on conflict (owner_id) do update set last_success = now(), last_attempt = now(), status = 'ok',
    last_full_sync = case when p_full then now() else eqfit_sync_state.last_full_sync end;
end;
$$;
revoke all on function public.eqfit_commit_sync(uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.eqfit_commit_sync(uuid, jsonb, boolean) to service_role;
create function public.eqfit_fail_sync(p_owner uuid) returns void language sql security invoker set search_path = '' as $$
  insert into public.eqfit_sync_state(owner_id, last_attempt, status) values(p_owner, now(), 'failed')
  on conflict(owner_id) do update set last_attempt = now(), status = 'failed';
$$;
revoke all on function public.eqfit_fail_sync(uuid) from public, anon, authenticated;
grant execute on function public.eqfit_fail_sync(uuid) to service_role;
commit;
