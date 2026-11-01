-- Preserve the planner's backup shape and save each workspace atomically.
create table public.planner_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"version":1,"logs":[],"projects":[],"settings":{"theme":"light","fontSize":"medium"}}'::jsonb,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint valid_workspace check (
    jsonb_typeof(data) = 'object'
    and data @> '{"version":1}'::jsonb
    and jsonb_typeof(data->'logs') = 'array'
    and jsonb_typeof(data->'projects') = 'array'
    and jsonb_typeof(data->'settings') = 'object'
    and (data->'settings'->>'theme') in ('light','dark')
    and (data->'settings'->>'fontSize') in ('xs','small','medium','large')
    and data ?& array['version','logs','projects','settings']
    and (data->'settings') ?& array['theme','fontSize']
  )
);
alter table public.planner_workspaces enable row level security;
revoke all on public.planner_workspaces from anon, authenticated;
grant select, insert, update on public.planner_workspaces to authenticated;
create policy "Read own planner" on public.planner_workspaces for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Create own planner" on public.planner_workspaces for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own planner" on public.planner_workspaces for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
comment on table public.planner_workspaces is 'Private personal planner snapshots. Revision compare-and-swap prevents stale clients overwriting newer edits.';
