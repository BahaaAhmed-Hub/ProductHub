-- ProductHub — Asana field mapping + comments + owner sync.
-- Lets a Manager configure how Asana's project-specific fields (sections,
-- custom fields — whatever the project actually has, discovered live via
-- the API, never hardcoded) translate into ProductHub's fixed columns, and
-- extends idempotent-import tracking to comments so re-sync doesn't
-- duplicate them.

create table if not exists integration_field_mappings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null check (provider in ('asana')),
  -- '__section__' for the project's board columns (always available), or an
  -- Asana custom field gid otherwise.
  source_field text not null,
  source_label text not null,
  target_field text not null check (target_field in ('board_status', 'priority', 'type', 'ignore')),
  -- { "<Asana option label>": "<ProductHub enum value>" }
  value_map jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, source_field)
);

alter table integration_field_mappings enable row level security;

drop policy if exists integration_field_mappings_manage on integration_field_mappings;
create policy integration_field_mappings_manage on integration_field_mappings for all
  using (workspace_id = current_workspace() and current_role_is(array['manager']::role[]))
  with check (workspace_id = current_workspace() and current_role_is(array['manager']::role[]));

-- Fallback display for an Asana assignee that doesn't match any workspace
-- member's email — keeps the name visible instead of silently dropping it.
alter table backlog_items add column if not exists external_assignee_name text;

-- Idempotent comment import, mirroring backlog_items' external tracking.
alter table item_notes add column if not exists external_source text;
alter table item_notes add column if not exists external_id text;
create unique index if not exists item_notes_external_uniq
  on item_notes (item_id, external_source, external_id);
