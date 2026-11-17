begin;
insert into auth.users (id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003');

set local role anon;
do $$
begin
  assert not has_table_privilege(current_user, 'public.team_workspaces', 'select');
  assert not has_function_privilege(current_user, 'public.join_team_workspace(uuid,text)', 'execute');
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001"}', true);
with workspace as (insert into public.team_workspaces(name) values ('Release planning') returning id)
select set_config('todop.test_workspace', id::text, true) from workspace;
with invite as (
  insert into public.team_workspace_invites(workspace_id)
  values (current_setting('todop.test_workspace')::uuid) returning token
)
select set_config('todop.test_invite', token::text, true) from invite;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002"}', true);
do $$
declare
  workspace uuid := current_setting('todop.test_workspace')::uuid;
  invite uuid := current_setting('todop.test_invite')::uuid;
begin
  assert not exists(select 1 from public.team_workspaces where id = workspace), 'Uninvited account saw private workspace';
  update public.team_workspaces set data = data where id = workspace;
  assert not found, 'Uninvited account wrote into private workspace';
  assert not exists(select 1 from public.team_workspace_invites where token = invite), 'Invitation token was readable';
  assert public.join_team_workspace(invite, 'Collaborator') = workspace;
  assert exists(select 1 from public.team_workspaces where id = workspace);
  update public.team_workspaces set data = jsonb_set(data, '{version}', '3') where id = workspace and revision = 0;
  assert found, 'Collaborator could not edit';
  assert (select revision from public.team_workspaces where id = workspace) = 1;
  update public.team_workspaces set data = data where id = workspace and revision = 0;
  assert not found, 'Stale revision was accepted';
  begin
    insert into public.team_workspace_invites(workspace_id) values (workspace);
    raise exception 'Collaborator created an invitation';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003"}', true);
do $$
begin
  begin
    perform public.join_team_workspace(current_setting('todop.test_invite')::uuid, 'Another collaborator');
    raise exception 'Invitation was reused';
  exception when raise_exception then
    if sqlerrm <> 'This invitation is expired, revoked, or already used.' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001"}', true);
do $$
declare
  workspace uuid := current_setting('todop.test_workspace')::uuid;
  revoked uuid;
begin
  assert (select display_name from public.team_workspace_members where workspace_id = workspace) = 'Collaborator';
  delete from public.team_workspace_members where workspace_id = workspace;
  assert found, 'Owner could not remove the collaborator';
  insert into public.team_workspace_invites(workspace_id) values (workspace) returning token into revoked;
  delete from public.team_workspace_invites where token = revoked;
  assert found, 'Owner could not revoke the invitation';
  perform set_config('todop.revoked_invite', revoked::text, true);
end $$;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002"}', true);
do $$
declare workspace uuid := current_setting('todop.test_workspace')::uuid;
begin
  assert not exists(select 1 from public.team_workspaces where id = workspace), 'Removed member retained read access';
  update public.team_workspaces set data = data where id = workspace;
  assert not found, 'Removed member retained write access';
  begin
    perform public.join_team_workspace(current_setting('todop.revoked_invite')::uuid, 'Collaborator');
    raise exception 'Revoked invitation was accepted';
  exception when raise_exception then
    if sqlerrm <> 'This invitation is expired, revoked, or already used.' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","is_anonymous":true}', true);
do $$
begin
  assert not exists(select 1 from public.team_workspaces), 'Anonymous session accessed workspaces';
end $$;

rollback;
