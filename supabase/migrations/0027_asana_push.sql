-- ProductHub — push local changes back to Asana. Idempotent.
--  * integration_connections.auto_push: when on, every edit to a synced task
--    is pushed to Asana immediately; when off, each task has a manual sync icon.
--  * integration_sync_log: one row per push attempt (what was sent, whether
--    Asana's re-read confirmed it).
--  * backlog_items.dirty_since: set when a pushable column changes locally,
--    cleared by a successful push. last_pulled_at lets the trigger tell an
--    Asana sync (which also writes those columns) from a user edit.

alter table integration_connections add column if not exists auto_push boolean not null default false;

create table if not exists integration_sync_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  item_id uuid references backlog_items(id) on delete set null,
  item_ref text,
  action text not null default 'push',
  status text not null check (status in ('ok', 'partial', 'error', 'skipped')),
  detail text not null default '',
  fields jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists integration_sync_log_ws on integration_sync_log(workspace_id, created_at desc);

alter table integration_sync_log enable row level security;
drop policy if exists integration_sync_log_read on integration_sync_log;
create policy integration_sync_log_read on integration_sync_log for select
  using (workspace_id = current_workspace() and current_role_is(array['pm','manager']::role[]));
drop policy if exists integration_sync_log_insert on integration_sync_log;
create policy integration_sync_log_insert on integration_sync_log for insert
  with check (workspace_id = current_workspace() and current_role_is(array['pm','manager']::role[]));

alter table backlog_items add column if not exists dirty_since timestamptz;
alter table backlog_items add column if not exists last_pulled_at timestamptz;

create or replace function mark_item_dirty()
returns trigger language plpgsql as $$
begin
  if new.external_source = 'asana'
     and new.last_pulled_at is not distinct from old.last_pulled_at
     and (new.title, new.type, new.priority, new.board_status, new.assignee_member_id,
          new.module, new.customer_name, new.estimated_hours)
         is distinct from
         (old.title, old.type, old.priority, old.board_status, old.assignee_member_id,
          old.module, old.customer_name, old.estimated_hours)
  then
    new.dirty_since := coalesce(old.dirty_since, now());
  end if;
  return new;
end $$;
drop trigger if exists backlog_items_mark_dirty on backlog_items;
create trigger backlog_items_mark_dirty before update on backlog_items
  for each row execute function mark_item_dirty();

-- Bulk-move tasks to a module (null = none), recording it as a hand edit so
-- Asana sync and auto-detection leave it alone. SECURITY INVOKER: RLS applies.
create or replace function set_items_module(item_ids uuid[], new_module text)
returns void language sql as $$
  update backlog_items
     set module = new_module,
         locked_fields = (select array_agg(distinct f) from unnest(locked_fields || array['module']) f)
   where id = any(item_ids);
$$;
