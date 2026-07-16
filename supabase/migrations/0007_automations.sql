-- ProductHub — automations storage (real, persisted rules). Idempotent.

create table if not exists automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  trigger text not null default '',
  action text not null default '',
  active boolean not null default true,
  runs int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists automations_ws on automations(workspace_id);

alter table automations enable row level security;
drop policy if exists automations_read on automations;
create policy automations_read on automations for select
  using (workspace_id = current_workspace()
         and current_role_is(array['developer','pm','manager']::role[]));
drop policy if exists automations_write on automations;
create policy automations_write on automations for all
  using (workspace_id = current_workspace()
         and current_role_is(array['pm','manager']::role[]))
  with check (workspace_id = current_workspace());
