-- ProductHub — initial schema (M0)
-- Multi-vendor SaaS: org → workspace → users, one shared backlog per workspace.
-- RLS is enabled on every table; policies scope rows to the caller's workspace
-- membership and role. Auth is Supabase Auth (email/password + Google).
--
-- NOTE: this is the foundation cut. Integrations, research, prioritization,
-- automations, and analytics tables arrive in their respective milestones.

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type role as enum ('customer','developer','pm','manager','stakeholder');
create type request_type as enum ('bug','feature','query');
create type priority as enum ('low','medium','high','critical');
create type request_status as enum ('submitted','triaged','in_development','in_qa','released','closed');
create type board_status as enum ('triaged','in_development','in_qa','released');
create type plan_tier as enum ('free','pro','enterprise');

-- ---------- tenancy ----------
create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan plan_tier not null default 'free',
  created_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Profile row per auth user. auth_uid links to auth.users.id.
create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_uid uuid not null unique references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  email text not null,
  role role not null default 'customer',
  avatar_url text,
  created_at timestamptz not null default now()
);
create index on profiles(workspace_id);
create index on profiles(auth_uid);

-- Invite-only access: an admin issues invites; accepting one provisions a profile.
create table invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role role not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references profiles(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);
create index on invites(workspace_id);

-- ---------- backlog spine ----------
create table requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ref text not null,
  type request_type not null,
  subject text not null,
  description text not null default '',
  priority priority not null default 'medium',
  product text,
  status request_status not null default 'submitted',
  sla_due_at timestamptz,
  first_response_at timestamptz,
  submitted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, ref)
);
create index on requests(workspace_id, status);

create table sprints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  starts_at date,
  ends_at date,
  goal text
);

create table releases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  target_date date,
  status text not null default 'planned',
  qa_checklist jsonb not null default '[]'::jsonb
);

create table backlog_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ref text not null,
  title text not null,
  description text,
  source_request_id uuid references requests(id) on delete set null,
  type request_type not null default 'feature',
  board_status board_status not null default 'triaged',
  priority priority not null default 'medium',
  assignee_id uuid references profiles(id),
  sprint_id uuid references sprints(id) on delete set null,
  release_id uuid references releases(id) on delete set null,
  swimlane text,
  plan_bucket text default 'backlog',
  rice_score numeric,
  created_at timestamptz not null default now(),
  unique (workspace_id, ref)
);
create index on backlog_items(workspace_id, board_status);

create table item_notes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references backlog_items(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index on item_notes(item_id);

create table roadmap_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  theme text,
  bucket text not null default 'later', -- now | next | later
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications(user_id, read_at);

-- ---------- helper: caller's workspace + role ----------
create or replace function current_profile()
returns profiles
language sql stable
as $$ select * from profiles where auth_uid = auth.uid() limit 1 $$;

create or replace function current_workspace()
returns uuid
language sql stable
as $$ select workspace_id from profiles where auth_uid = auth.uid() limit 1 $$;

create or replace function current_role_is(target role[])
returns boolean
language sql stable
as $$ select exists (
  select 1 from profiles where auth_uid = auth.uid() and role = any(target)
) $$;

-- ---------- RLS ----------
alter table orgs           enable row level security;
alter table workspaces     enable row level security;
alter table profiles       enable row level security;
alter table invites        enable row level security;
alter table requests       enable row level security;
alter table sprints        enable row level security;
alter table releases       enable row level security;
alter table backlog_items  enable row level security;
alter table item_notes     enable row level security;
alter table roadmap_items  enable row level security;
alter table notifications  enable row level security;

-- Everyone can read their own workspace + profiles in it.
create policy ws_read on workspaces for select
  using (id = current_workspace());

create policy profiles_read on profiles for select
  using (workspace_id = current_workspace());

-- Requests: any member reads workspace requests; customers create; staff update.
create policy requests_read on requests for select
  using (workspace_id = current_workspace());
create policy requests_insert on requests for insert
  with check (workspace_id = current_workspace());
create policy requests_update on requests for update
  using (workspace_id = current_workspace()
         and current_role_is(array['developer','pm','manager']::role[]));

-- Backlog: internal staff only (customers never see the raw backlog).
create policy items_read on backlog_items for select
  using (workspace_id = current_workspace()
         and current_role_is(array['developer','pm','manager']::role[]));
create policy items_write on backlog_items for all
  using (workspace_id = current_workspace()
         and current_role_is(array['developer','pm','manager']::role[]))
  with check (workspace_id = current_workspace());

-- Internal notes are readable only by staff; public notes by everyone in ws.
create policy notes_read on item_notes for select
  using (
    exists (select 1 from backlog_items b
            where b.id = item_notes.item_id and b.workspace_id = current_workspace())
    and (not is_internal or current_role_is(array['developer','pm','manager']::role[]))
  );
create policy notes_write on item_notes for insert
  with check (
    exists (select 1 from backlog_items b
            where b.id = item_notes.item_id and b.workspace_id = current_workspace())
  );

-- Sprints / releases: staff read+write within workspace.
create policy sprints_all on sprints for all
  using (workspace_id = current_workspace()
         and current_role_is(array['developer','pm','manager']::role[]))
  with check (workspace_id = current_workspace());
create policy releases_all on releases for all
  using (workspace_id = current_workspace()
         and current_role_is(array['developer','pm','manager']::role[]))
  with check (workspace_id = current_workspace());

-- Roadmap: published items readable by all workspace members (incl. customer/stakeholder);
-- staff manage all.
create policy roadmap_read on roadmap_items for select
  using (workspace_id = current_workspace()
         and (is_published or current_role_is(array['developer','pm','manager']::role[])));
create policy roadmap_write on roadmap_items for all
  using (workspace_id = current_workspace()
         and current_role_is(array['pm','manager']::role[]))
  with check (workspace_id = current_workspace());

-- Invites: staff manage within workspace.
create policy invites_all on invites for all
  using (workspace_id = current_workspace()
         and current_role_is(array['pm','manager']::role[]))
  with check (workspace_id = current_workspace());

-- Notifications: users see only their own.
create policy notif_read on notifications for select
  using (user_id = (select id from profiles where auth_uid = auth.uid()));
create policy notif_update on notifications for update
  using (user_id = (select id from profiles where auth_uid = auth.uid()));
