create schema if not exists todop_private;
revoke all on schema todop_private from public, anon, authenticated;
grant usage on schema todop_private to authenticated;

create function todop_private.valid_planner_snapshot(snapshot jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select (
    jsonb_typeof(snapshot) = 'object'
    and jsonb_typeof(snapshot->'version') = 'number'
    and (snapshot->>'version') in ('1', '2', '3')
    and jsonb_typeof(snapshot->'logs') = 'array'
    and jsonb_typeof(snapshot->'projects') = 'array'
    and jsonb_typeof(snapshot->'settings') = 'object'
    and (snapshot->'settings'->>'theme') in ('light', 'dark')
    and (snapshot->'settings'->>'fontSize') in ('xs', 'small', 'medium', 'large')
    and (not (snapshot ? 'trash') or jsonb_typeof(snapshot->'trash') = 'array')
  ) is true;
$$;

alter table public.planner_workspaces drop constraint valid_workspace;
alter table public.planner_workspaces add constraint valid_workspace
  check (todop_private.valid_planner_snapshot(data));

create function todop_private.team_user_id()
returns uuid
language sql stable set search_path = ''
as $$
  select case when coalesce(auth.jwt()->>'is_anonymous', 'false') <> 'true' then auth.uid() end;
$$;

create table public.team_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default todop_private.team_user_id() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  data jsonb not null default '{"version":2,"logs":[],"trash":[],"projects":[],"settings":{"theme":"light","fontSize":"medium"}}',
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint valid_team_workspace check (todop_private.valid_planner_snapshot(data))
);
create index team_workspaces_owner_idx on public.team_workspaces(owner_id);

create table public.team_workspace_members (
  workspace_id uuid not null references public.team_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  primary key (workspace_id, user_id)
);
create index team_workspace_members_user_idx on public.team_workspace_members(user_id, workspace_id);

create table public.team_workspace_invites (
  token uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.team_workspaces(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index team_workspace_invites_workspace_idx on public.team_workspace_invites(workspace_id);

-- Membership policies use this narrow owner lookup without recursing into workspace RLS.
create function todop_private.owns_team_workspace(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_workspaces
    where id = target and owner_id = (select todop_private.team_user_id())
  );
$$;
revoke all on function todop_private.owns_team_workspace(uuid) from public, anon, authenticated;
grant execute on function todop_private.owns_team_workspace(uuid) to authenticated;

create function todop_private.advance_team_workspace_revision()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.revision = old.revision + 1;
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function todop_private.advance_team_workspace_revision() from public, anon, authenticated;
create trigger team_workspace_revision before update on public.team_workspaces
for each row execute function todop_private.advance_team_workspace_revision();

alter table public.team_workspaces enable row level security;
alter table public.team_workspace_members enable row level security;
alter table public.team_workspace_invites enable row level security;
revoke all on public.team_workspaces, public.team_workspace_members, public.team_workspace_invites from public, anon, authenticated;
grant select on public.team_workspaces to authenticated;
grant insert (name), update (data) on public.team_workspaces to authenticated;
grant select, delete on public.team_workspace_members, public.team_workspace_invites to authenticated;
grant insert (workspace_id) on public.team_workspace_invites to authenticated;

create policy "View joined workspaces" on public.team_workspaces for select to authenticated
using (
  owner_id = (select todop_private.team_user_id()) or
  id in (select workspace_id from public.team_workspace_members where user_id = (select todop_private.team_user_id()))
);
create policy "Create owned workspace" on public.team_workspaces for insert to authenticated
with check (owner_id = (select todop_private.team_user_id()));
create policy "Edit joined workspaces" on public.team_workspaces for update to authenticated
using (
  owner_id = (select todop_private.team_user_id()) or
  id in (select workspace_id from public.team_workspace_members where user_id = (select todop_private.team_user_id()))
)
with check (
  owner_id = (select todop_private.team_user_id()) or
  id in (select workspace_id from public.team_workspace_members where user_id = (select todop_private.team_user_id()))
);

create policy "See own membership or owned roster" on public.team_workspace_members for select to authenticated
using (user_id = (select todop_private.team_user_id()) or (select todop_private.owns_team_workspace(workspace_id)));
create policy "Remove members from owned workspace" on public.team_workspace_members for delete to authenticated
using (user_id = (select todop_private.team_user_id()) or (select todop_private.owns_team_workspace(workspace_id)));

create policy "View own invitations" on public.team_workspace_invites for select to authenticated
using ((select todop_private.owns_team_workspace(workspace_id)));
create policy "Create invites for owned workspaces" on public.team_workspace_invites for insert to authenticated
with check ((select todop_private.owns_team_workspace(workspace_id)));
create policy "Revoke own invitations" on public.team_workspace_invites for delete to authenticated
using ((select todop_private.owns_team_workspace(workspace_id)));

-- Only the redemption function can create a membership. Locking the invitation
-- serializes two claims, and a failed claim never consumes the link.
create function todop_private.redeem_team_invite(invite_token uuid, member_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  member_id uuid := todop_private.team_user_id();
  target uuid;
begin
  if member_id is null then
    raise exception 'Sign in to accept a workspace invitation.' using errcode = '42501';
  end if;
  if member_name is null or char_length(btrim(member_name)) not between 1 and 80 then
    raise exception 'Enter a display name.';
  end if;

  select workspace_id into target from public.team_workspace_invites
  where token = invite_token and expires_at > now() for update;
  if target is null then
    raise exception 'This invitation is expired, revoked, or already used.';
  end if;
  if todop_private.owns_team_workspace(target) or exists (
    select 1 from public.team_workspace_members where workspace_id = target and user_id = member_id
  ) then
    return target;
  end if;

  insert into public.team_workspace_members (workspace_id, user_id, display_name)
  values (target, member_id, btrim(member_name))
  on conflict (workspace_id, user_id) do nothing;
  delete from public.team_workspace_invites where token = invite_token;
  return target;
end;
$$;
revoke all on function todop_private.redeem_team_invite(uuid, text) from public, anon, authenticated;
grant execute on function todop_private.redeem_team_invite(uuid, text) to authenticated;

create function public.join_team_workspace(invite_token uuid, member_name text)
returns uuid
language sql security invoker set search_path = ''
as $$ select todop_private.redeem_team_invite(invite_token, member_name) $$;
revoke all on function public.join_team_workspace(uuid, text) from public, anon, authenticated;
grant execute on function public.join_team_workspace(uuid, text) to authenticated;
