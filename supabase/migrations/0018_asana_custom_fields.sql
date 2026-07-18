-- ProductHub — real dynamic custom fields, created on the fly from the
-- Asana field-mapping panel ("create a new field with this name") instead
-- of only being able to append a value to the description. Each definition
-- is workspace-scoped; values live per item in a JSONB column keyed by
-- definition id, since backlog_items can't grow a real column per customer.

create table if not exists custom_field_defs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  source text not null default 'asana',
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

alter table custom_field_defs enable row level security;

-- Same visibility as the backlog itself (items_read) — customers never see
-- the raw backlog and shouldn't see its custom fields either.
drop policy if exists custom_field_defs_read on custom_field_defs;
create policy custom_field_defs_read on custom_field_defs for select
  using (workspace_id = current_workspace() and current_role_is(array['developer','pm','manager']::role[]));

drop policy if exists custom_field_defs_manage on custom_field_defs;
create policy custom_field_defs_manage on custom_field_defs for all
  using (workspace_id = current_workspace() and current_role_is(array['manager']::role[]))
  with check (workspace_id = current_workspace());

alter table backlog_items add column if not exists custom_fields jsonb not null default '{}'::jsonb;

alter table integration_field_mappings add column if not exists custom_field_def_id uuid references custom_field_defs(id) on delete cascade;

alter table integration_field_mappings drop constraint if exists integration_field_mappings_target_field_check;
alter table integration_field_mappings add constraint integration_field_mappings_target_field_check
  check (target_field in ('board_status', 'priority', 'type', 'description', 'custom', 'ignore'));
