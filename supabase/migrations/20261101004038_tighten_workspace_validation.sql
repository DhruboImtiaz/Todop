alter table public.planner_workspaces drop constraint valid_workspace;
alter table public.planner_workspaces add constraint valid_workspace check ((
    jsonb_typeof(data) = 'object'
    and data @> '{"version":1}'::jsonb
    and jsonb_typeof(data->'logs') = 'array'
    and jsonb_typeof(data->'projects') = 'array'
    and jsonb_typeof(data->'settings') = 'object'
    and (data->'settings'->>'theme') in ('light','dark')
    and (data->'settings'->>'fontSize') in ('xs','small','medium','large')
    and data ?& array['version','logs','projects','settings']
    and (data->'settings') ?& array['theme','fontSize']
) is true);
