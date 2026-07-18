-- ProductHub — Platform Admin: cross-tenant ops console (separate repo,
-- ProductHub-Admin) sharing this Supabase project. Platform admins are
-- ProductHub's own staff, not scoped to any single org/workspace — a
-- fundamentally different trust boundary from every other table here, so
-- they get their own table + RLS helper rather than reusing profiles/role.
--
-- SECURITY DEFINER on the helpers mirrors 0004_fix_rls_recursion.sql's fix:
-- a SECURITY INVOKER helper that reads platform_admins from inside a
-- platform_admins RLS policy would re-trigger that same policy → infinite
-- recursion. A direct self-read policy is added too, belt-and-suspenders.

create table if not exists platform_admins (
  id uuid primary key default gen_random_uuid(),
  auth_uid uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'Support Ops'
    check (role in ('Platform Owner', 'Billing Admin', 'IT / Security Admin', 'Support Ops')),
  area text not null default '',
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);
create index if not exists platform_admins_auth_uid on platform_admins(auth_uid);

create or replace function is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where auth_uid = auth.uid() and status = 'active')
$$;

create or replace function is_platform_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from platform_admins where auth_uid = auth.uid() and status = 'active' and role = 'Platform Owner'
  )
$$;

create or replace function current_platform_admin()
returns platform_admins language sql stable security definer set search_path = public as $$
  select * from platform_admins where auth_uid = auth.uid() limit 1
$$;

alter table platform_admins enable row level security;

drop policy if exists platform_admins_self_read on platform_admins;
create policy platform_admins_self_read on platform_admins for select
  using (auth_uid = auth.uid());

drop policy if exists platform_admins_read on platform_admins;
create policy platform_admins_read on platform_admins for select
  using (is_platform_admin());

-- Only a Platform Owner adds/edits/removes other admins — every other
-- platform_* table below is writable by any active platform admin.
drop policy if exists platform_admins_manage on platform_admins;
create policy platform_admins_manage on platform_admins for all
  using (is_platform_owner())
  with check (is_platform_owner());

-- Extends the same on_auth_user_created trigger used for every customer/
-- staff signup — a platform admin invite (see the new platform-invite-admin
-- Edge Function) sets platform_admin_role in user_metadata, which this
-- branch checks FIRST and, if present, provisions a platform_admins row and
-- returns immediately — skipping every org/workspace/profiles path below,
-- since a platform admin isn't a tenant of any workspace.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_domain text;
  v_name text;
  v_req role;
  v_org uuid;
  v_ws uuid;
  v_org_name text;
  v_invite_code text;
  v_invite record;
  v_join_key text;
  v_join record;
  v_member_role text;
  v_member_ws uuid;
  v_platform_role text;
begin
  v_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_platform_role := new.raw_user_meta_data->>'platform_admin_role';

  if v_platform_role is not null then
    if exists (select 1 from platform_admins where auth_uid = new.id) then
      return new;
    end if;
    insert into platform_admins(auth_uid, name, email, role, status)
      values (new.id, v_name, new.email, v_platform_role, 'active');
    return new;
  end if;

  if exists (select 1 from profiles where auth_uid = new.id) then
    return new;
  end if;

  v_member_role := new.raw_user_meta_data->>'member_invite_role';
  v_member_ws := nullif(new.raw_user_meta_data->>'member_invite_workspace_id', '')::uuid;

  if v_member_role is not null and v_member_ws is not null then
    insert into profiles(auth_uid, workspace_id, name, email, role, status, requested_role, invited_at, avatar_url)
      values (new.id, v_member_ws, v_name, new.email, v_member_role::role, 'invited', v_member_role::role, now(),
              new.raw_user_meta_data->>'avatar_url');
    return new;
  end if;

  v_invite_code := new.raw_user_meta_data->>'invite_code';
  v_join_key := coalesce(new.raw_user_meta_data->>'join_code', new.raw_user_meta_data->>'join_slug');

  if v_join_key is not null then
    select * into v_join from workspace_join
      where code = upper(v_join_key) or slug = lower(v_join_key)
      limit 1;
    if found then
      insert into profiles(auth_uid, workspace_id, name, email, role, status, requested_role, avatar_url)
        values (new.id, v_join.workspace_id, v_name, new.email, 'customer', 'active', 'customer',
                new.raw_user_meta_data->>'avatar_url');
      return new;
    end if;
  end if;

  if v_invite_code is not null then
    select * into v_invite from workspace_invites
      where code = v_invite_code and not revoked
        and (expires_at is null or expires_at > now())
      limit 1;
    if found then
      insert into profiles(auth_uid, workspace_id, name, email, role, status, requested_role, avatar_url)
        values (new.id, v_invite.workspace_id, v_name, new.email, v_invite.role, 'active', v_invite.role,
                new.raw_user_meta_data->>'avatar_url');
      return new;
    end if;
  end if;

  v_domain := lower(split_part(new.email, '@', 2));
  v_req := case
    when (new.raw_user_meta_data->>'role') in ('pm','developer')
    then (new.raw_user_meta_data->>'role')::role else 'pm'::role end;

  if v_domain = '' or is_personal_domain(v_domain) then
    insert into orgs(name, plan) values (v_name, 'free') returning id into v_org;
    insert into workspaces(org_id, name) values (v_org, v_name || '''s workspace') returning id into v_ws;
    insert into profiles(auth_uid, workspace_id, name, email, role, status, requested_role, avatar_url)
      values (new.id, v_ws, v_name, new.email, 'manager', 'active', 'manager', new.raw_user_meta_data->>'avatar_url');
    perform ensure_workspace_join(v_ws, v_name || '''s workspace');
    return new;
  end if;

  select id into v_ws from workspaces where domain = v_domain limit 1;
  v_org_name := initcap(split_part(v_domain, '.', 1));

  if v_ws is null then
    insert into orgs(name, plan) values (v_org_name, 'free') returning id into v_org;
    insert into workspaces(org_id, name, domain) values (v_org, v_org_name, v_domain) returning id into v_ws;
    insert into profiles(auth_uid, workspace_id, name, email, role, status, requested_role, avatar_url)
      values (new.id, v_ws, v_name, new.email, 'manager', 'active', 'manager', new.raw_user_meta_data->>'avatar_url');
    perform ensure_workspace_join(v_ws, v_org_name);
  else
    insert into profiles(auth_uid, workspace_id, name, email, role, status, requested_role, avatar_url)
      values (new.id, v_ws, v_name, new.email, 'customer', 'pending', v_req, new.raw_user_meta_data->>'avatar_url');
    insert into notifications(user_id, kind, title, body)
      select p.id, 'approval', v_name || ' requested ' || v_req || ' access',
             new.email || ' is waiting for approval in ' || v_org_name
      from profiles p
      where p.workspace_id = v_ws and p.role = 'manager';
  end if;
  return new;
end $$;

-- ---------- cross-tenant read/write for existing tenant tables ----------
-- Additive only — every existing tenant-scoped policy is untouched, this
-- just widens who else can see/touch a row.

alter table orgs add column if not exists status text not null default 'active';
alter table orgs drop constraint if exists orgs_status_check;
alter table orgs add constraint orgs_status_check check (status in ('active', 'suspended'));

drop policy if exists orgs_platform_admin_read on orgs;
create policy orgs_platform_admin_read on orgs for select
  using (is_platform_admin());
drop policy if exists orgs_platform_admin_update on orgs;
create policy orgs_platform_admin_update on orgs for update
  using (is_platform_admin())
  with check (is_platform_admin());

drop policy if exists workspaces_platform_admin_read on workspaces;
create policy workspaces_platform_admin_read on workspaces for select
  using (is_platform_admin());

drop policy if exists profiles_platform_admin_all on profiles;
create policy profiles_platform_admin_all on profiles for all
  using (is_platform_admin())
  with check (is_platform_admin());

-- ---------- platform-level support tables ----------

create table if not exists platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_admin_id uuid references platform_admins(id) on delete set null,
  actor_name text not null,
  action text not null,
  target text not null,
  created_at timestamptz not null default now()
);
create index if not exists platform_audit_log_created on platform_audit_log(created_at desc);

create table if not exists platform_company_invites (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_email text not null,
  created_by uuid references platform_admins(id) on delete set null,
  sent_at timestamptz not null default now()
);

create table if not exists platform_security_settings (
  id int primary key default 1 check (id = 1),
  sso_connected boolean not null default true,
  scim_enabled boolean not null default true,
  two_factor_enforced boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into platform_security_settings (id) values (1) on conflict (id) do nothing;

create table if not exists platform_ip_allowlist (
  id uuid primary key default gen_random_uuid(),
  cidr text not null,
  label text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists platform_api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scopes text not null default '',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- Seed rows are static display data (no real OAuth behind them), same
-- convention as ProductHub's own IntegrationsScreen mock Slack/GitHub/
-- PostHog cards alongside the one real (Asana) integration.
create table if not exists platform_integrations (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null default '',
  status text not null default 'disconnected' check (status in ('connected', 'needs_reauth', 'disconnected'))
);
insert into platform_integrations (key, name, description, status) values
  ('slack', 'Slack', 'Alerts & mentions', 'connected'),
  ('github', 'GitHub', 'Issue sync', 'connected'),
  ('jira', 'Jira', 'Backlog import', 'connected'),
  ('zendesk', 'Zendesk', 'Support tickets', 'needs_reauth')
on conflict (key) do nothing;

create table if not exists platform_webhooks (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  events text not null default '',
  status text not null default 'healthy' check (status in ('healthy', 'failing')),
  last_delivery_at timestamptz
);

create table if not exists platform_oauth_requests (
  id uuid primary key default gen_random_uuid(),
  requester_name text not null,
  description text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now()
);

create table if not exists platform_alert_rules (
  id uuid primary key default gen_random_uuid(),
  trigger_name text not null,
  condition text not null,
  channel text not null,
  status text not null default 'active' check (status in ('active', 'muted'))
);

create table if not exists platform_data_requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('Export', 'Delete')),
  requester_org_id uuid references orgs(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'platform_audit_log', 'platform_company_invites', 'platform_security_settings',
    'platform_ip_allowlist', 'platform_api_keys', 'platform_integrations', 'platform_webhooks',
    'platform_oauth_requests', 'platform_alert_rules', 'platform_data_requests'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_platform_admin_all on %I', t, t);
    execute format(
      'create policy %I_platform_admin_all on %I for all using (is_platform_admin()) with check (is_platform_admin())',
      t, t
    );
  end loop;
end $$;
