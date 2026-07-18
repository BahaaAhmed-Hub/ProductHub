-- ProductHub — customizable Reports dashboard: Managers add widgets from a
-- small library, drag to reorder, resize, and give each a custom title
-- describing what it's for. Layout (position/size) persists per workspace.

create table if not exists report_widgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null check (kind in (
    'by_type', 'by_status', 'by_priority', 'sla_breaches', 'recent_activity', 'team_workload', 'rice_top'
  )),
  title text not null,
  x int not null default 0,
  y int not null default 0,
  w int not null default 4,
  h int not null default 4,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists report_widgets_workspace on report_widgets(workspace_id);

alter table report_widgets enable row level security;

-- Same audience as the Reports route itself (pm + manager).
drop policy if exists report_widgets_read on report_widgets;
create policy report_widgets_read on report_widgets for select
  using (workspace_id = current_workspace() and current_role_is(array['pm', 'manager']::role[]));

-- Only a Manager designs the dashboard, matching "designable by" the account owner.
drop policy if exists report_widgets_manage on report_widgets;
create policy report_widgets_manage on report_widgets for all
  using (workspace_id = current_workspace() and current_role_is(array['manager']::role[]))
  with check (workspace_id = current_workspace());
