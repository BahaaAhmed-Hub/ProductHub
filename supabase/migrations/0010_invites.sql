-- ProductHub — invite links for team members. Idempotent.

create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  role role not null default 'customer',
  code text not null unique default encode(gen_random_bytes(9), 'base64'),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked boolean not null default false
);
create index if not exists workspace_invites_ws on workspace_invites(workspace_id);
create index if not exists workspace_invites_code on workspace_invites(code) where not revoked;

alter table workspace_invites enable row level security;

-- Managers manage invites for their own workspace.
drop policy if exists invites_manage on workspace_invites;
create policy invites_manage on workspace_invites for all
  using (workspace_id = current_workspace() and current_role_is(array['manager']::role[]))
  with check (workspace_id = current_workspace());

-- Anyone (including anon, pre-signup) can look up a single invite by its code
-- to validate/apply it — no workspace membership required yet.
drop policy if exists invites_read_by_code on workspace_invites;
create policy invites_read_by_code on workspace_invites for select
  using (not revoked and (expires_at is null or expires_at > now()));

-- profiles_read (0001_init) already covers "everyone reads profiles in their
-- own workspace", which is what the Team screen needs — no extra policy required.
