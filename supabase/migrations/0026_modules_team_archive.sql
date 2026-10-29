-- ProductHub — modules catalog, assignable team roster, archive + manual-edit
-- tracking on backlog items. Idempotent.
--
-- team_members is separate from profiles on purpose: profiles.auth_uid is
-- NOT NULL (every profile is a real login), but Asana assignees usually
-- haven't signed up here. The roster holds both — people with a login are
-- linked via profile_id, Asana-only people just carry their Asana gid.

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  email text,
  profile_id uuid references profiles(id) on delete set null,
  external_source text,
  external_id text,
  created_at timestamptz not null default now(),
  unique (workspace_id, external_source, external_id)
);
create index if not exists team_members_ws on team_members(workspace_id);
create index if not exists team_members_email on team_members(workspace_id, lower(email));

alter table team_members enable row level security;
drop policy if exists team_members_read on team_members;
create policy team_members_read on team_members for select
  using (workspace_id = current_workspace()
         and current_role_is(array['developer','pm','manager']::role[]));
drop policy if exists team_members_write on team_members;
create policy team_members_write on team_members for all
  using (workspace_id = current_workspace() and current_role_is(array['pm','manager']::role[]))
  with check (workspace_id = current_workspace());

-- Existing internal profiles become roster entries.
insert into team_members (workspace_id, name, email, profile_id)
select p.workspace_id, p.name, p.email, p.id
from profiles p
where p.role in ('developer', 'pm', 'manager')
  and coalesce(p.status, 'active') = 'active'
  and not exists (select 1 from team_members t where t.profile_id = p.id);

-- Keep the roster in step with profiles (new/approved internal members).
create or replace function sync_team_member_from_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role in ('developer', 'pm', 'manager') and coalesce(new.status, 'active') = 'active' then
    update team_members set name = new.name, email = new.email, profile_id = new.id
      where profile_id = new.id
         or (profile_id is null and workspace_id = new.workspace_id and lower(email) = lower(new.email));
    if not found then
      insert into team_members (workspace_id, name, email, profile_id)
        values (new.workspace_id, new.name, new.email, new.id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_sync_team_member on profiles;
create trigger profiles_sync_team_member after insert or update of role, status, name, email on profiles
  for each row execute function sync_team_member_from_profile();

-- Modules: a catalog per workspace with optional sub-modules (parent_id).
-- aliases are extra keywords the module detector matches against titles/bodies.
create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text not null default '',
  parent_id uuid references modules(id) on delete cascade,
  aliases text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);
create unique index if not exists modules_ws_name on modules(workspace_id, lower(name));

alter table modules enable row level security;
drop policy if exists modules_read on modules;
create policy modules_read on modules for select
  using (workspace_id = current_workspace()
         and current_role_is(array['developer','pm','manager']::role[]));
drop policy if exists modules_write on modules;
create policy modules_write on modules for all
  using (workspace_id = current_workspace() and current_role_is(array['pm','manager']::role[]))
  with check (workspace_id = current_workspace());

-- backlog_items keeps module as plain text (Asana mapping writes it too);
-- these triggers keep it consistent with the catalog.
create or replace function modules_propagate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.name <> new.name then
    update backlog_items set module = new.name where workspace_id = old.workspace_id and module = old.name;
  elsif tg_op = 'DELETE' then
    update backlog_items set module = null where workspace_id = old.workspace_id and module = old.name;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists modules_propagate_trg on modules;
create trigger modules_propagate_trg after update of name or delete on modules
  for each row execute function modules_propagate();

-- Seed the catalog from modules already present on items (e.g. Asana-mapped).
insert into modules (workspace_id, name)
select distinct on (workspace_id, lower(module)) workspace_id, module
from backlog_items
where module is not null and btrim(module) <> ''
on conflict do nothing;

alter table backlog_items add column if not exists assignee_member_id uuid references team_members(id) on delete set null;
alter table backlog_items add column if not exists archived_at timestamptz;
-- Fields a person edited by hand ('type', 'module'); sync and auto-detection leave these alone.
alter table backlog_items add column if not exists locked_fields text[] not null default '{}'::text[];

-- Link existing assignees to roster entries.
update backlog_items b set assignee_member_id = t.id
from team_members t
where b.assignee_member_id is null and b.assignee_id is not null and t.profile_id = b.assignee_id;
