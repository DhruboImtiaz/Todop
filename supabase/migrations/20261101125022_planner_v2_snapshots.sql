-- Additive: existing v1 clients/workspaces stay valid until their owner uses v2.
-- Older applications reject version 2 on read, preventing silent loss of new fields.
alter table public.planner_workspaces drop constraint valid_workspace;
alter table public.planner_workspaces add constraint valid_workspace check ((
  jsonb_typeof(data) = 'object'
  and jsonb_typeof(data->'version') = 'number'
  and (data->>'version') in ('1','2')
  and jsonb_typeof(data->'logs') = 'array'
  and jsonb_typeof(data->'projects') = 'array'
  and jsonb_typeof(data->'settings') = 'object'
  and (data->'settings'->>'theme') in ('light','dark')
  and (data->'settings'->>'fontSize') in ('xs','small','medium','large')
  and data ?& array['version','logs','projects','settings']
  and (data->'settings') ?& array['theme','fontSize']
  and (not (data ? 'trash') or jsonb_typeof(data->'trash') = 'array')
) is true);
