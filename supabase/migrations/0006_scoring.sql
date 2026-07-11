-- ProductHub — scoring + prioritization models (real, persisted).
-- Idempotent.

-- Persist all scoring inputs + a computed WSJF score on backlog items.
alter table backlog_items add column if not exists wsjf_score numeric;
alter table backlog_items add column if not exists score_inputs jsonb not null default '{}'::jsonb;
-- effort estimate used by RICE and the value/effort matrix
alter table backlog_items add column if not exists effort numeric;

-- Custom weighted prioritization models.
create table if not exists prioritization_models (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  criteria jsonb not null default '[]'::jsonb, -- [{key,label,weight}]
  created_at timestamptz not null default now()
);
create index if not exists prioritization_models_ws on prioritization_models(workspace_id);

alter table prioritization_models enable row level security;
drop policy if exists models_read on prioritization_models;
create policy models_read on prioritization_models for select
  using (workspace_id = current_workspace()
         and current_role_is(array['developer','pm','manager']::role[]));
drop policy if exists models_write on prioritization_models;
create policy models_write on prioritization_models for all
  using (workspace_id = current_workspace()
         and current_role_is(array['pm','manager']::role[]))
  with check (workspace_id = current_workspace());
