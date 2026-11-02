create table public.eqfit_sync_owner (
  singleton boolean primary key default true check(singleton),
  owner_id uuid not null references auth.users(id)
);
alter table public.eqfit_sync_owner enable row level security;
revoke all on public.eqfit_sync_owner from public, anon, authenticated;
grant select on public.eqfit_sync_owner to service_role;
