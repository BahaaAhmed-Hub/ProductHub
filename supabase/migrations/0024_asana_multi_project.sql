-- ProductHub — Asana: sync from more than one project per workspace.
-- integration_connections now holds only the OAuth token (one per
-- workspace+provider, unchanged); which project(s) to pull tasks from moves
-- to this new one-to-many table. Existing single-project connections are
-- backfilled into it below so nobody loses their current setup.

create table if not exists integration_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  connection_id uuid not null references integration_connections(id) on delete cascade,
  provider text not null default 'asana' check (provider in ('asana')),
  external_workspace_gid text,
  external_workspace_name text,
  external_project_gid text not null,
  external_project_name text not null,
  added_by uuid references profiles(id),
  added_at timestamptz not null default now(),
  last_synced_at timestamptz,
  unique (connection_id, external_project_gid)
);
create index if not exists integration_projects_workspace on integration_projects(workspace_id);

alter table integration_projects enable row level security;

drop policy if exists integration_projects_manage on integration_projects;
create policy integration_projects_manage on integration_projects for all
  using (workspace_id = current_workspace() and current_role_is(array['manager']::role[]))
  with check (workspace_id = current_workspace() and current_role_is(array['manager']::role[]));

-- Backfill the one project each existing connection already had selected.
insert into integration_projects (
  workspace_id, connection_id, provider, external_workspace_gid, external_workspace_name,
  external_project_gid, external_project_name, added_by, last_synced_at
)
select
  workspace_id, id, provider, external_workspace_gid, external_workspace_name,
  external_project_gid, external_project_name, connected_by, last_synced_at
from integration_connections
where provider = 'asana' and external_project_gid is not null
on conflict (connection_id, external_project_gid) do nothing;
