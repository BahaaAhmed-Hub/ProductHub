-- ProductHub — Asana integration (v1: OAuth connect + manual one-way import).
-- Scope: pull Asana tasks from a chosen project into the shared backlog as
-- backlog_items. Push-back / two-way sync is a later milestone.

create table if not exists integration_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null check (provider in ('asana')),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  external_workspace_gid text,
  external_workspace_name text,
  external_project_gid text,
  external_project_name text,
  connected_by uuid references profiles(id),
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  unique (workspace_id, provider)
);

alter table integration_connections enable row level security;

-- Holds OAuth tokens — manager-only end to end, no broader workspace read.
drop policy if exists integration_connections_manage on integration_connections;
create policy integration_connections_manage on integration_connections for all
  using (workspace_id = current_workspace() and current_role_is(array['manager']::role[]))
  with check (workspace_id = current_workspace() and current_role_is(array['manager']::role[]));

-- Idempotent-import mapping: lets asana-sync re-run safely (upsert instead of
-- duplicate) without needing to track a separate join table. A plain (not
-- partial) unique index still allows unlimited organic rows where
-- external_source/external_id are both null — Postgres never treats two
-- nulls as equal for uniqueness — and a plain index is what supabase-js's
-- upsert(..., { onConflict }) can target without a WHERE clause.
alter table backlog_items add column if not exists external_source text;
alter table backlog_items add column if not exists external_id text;
create unique index if not exists backlog_items_external_uniq
  on backlog_items (workspace_id, external_source, external_id);
