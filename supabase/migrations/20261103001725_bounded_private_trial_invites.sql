create table public.eqfit_trial_invites (
 token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,
 attempts integer not null default 0 check (attempts between 0 and 20)
);
alter table public.eqfit_trial_invites enable row level security;
revoke all on public.eqfit_trial_invites from public, anon, authenticated;
grant all on public.eqfit_trial_invites to service_role;
create function public.eqfit_claim_trial(p_hash text) returns boolean language sql volatile security invoker set search_path='' as $$
 with claimed as (update public.eqfit_trial_invites set attempts=attempts+1
 where token_hash=p_hash and expires_at>now() and attempts<20 returning 1)
 select exists(select 1 from claimed);
$$;
revoke all on function public.eqfit_claim_trial(text) from public,anon,authenticated;
grant execute on function public.eqfit_claim_trial(text) to service_role;
