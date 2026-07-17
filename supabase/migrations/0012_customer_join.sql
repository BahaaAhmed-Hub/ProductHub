-- ProductHub — end-user (customer) join code + invite link, pre-signup domain
-- check, and two RLS fixes found while wiring this. Idempotent.

-- =====================================================================
-- 1. End-user join (Batch 4 of the FlowDesk spec)
-- =====================================================================
-- End users (a workspace's own ticket-filing customers) never pick a role and
-- never go through approval — they attach to exactly one workspace via a
-- short join code or a stable invite link, both always resolving to
-- role='customer', status='active'. Separate from workspace_invites (0010),
-- which now exists purely for the Stakeholder link.

create table if not exists workspace_join (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  code text not null unique,
  slug text not null unique,
  updated_at timestamptz not null default now()
);

alter table workspace_join enable row level security;

drop policy if exists workspace_join_manage on workspace_join;
create policy workspace_join_manage on workspace_join for all
  using (workspace_id = current_workspace() and current_role_is(array['manager']::role[]))
  with check (workspace_id = current_workspace());

-- Public lookup by code/slug is required pre-signup (no workspace membership
-- yet) — mirrors workspace_invites' invites_read_by_code policy.
drop policy if exists workspace_join_read on workspace_join;
create policy workspace_join_read on workspace_join for select using (true);

create or replace function random_join_suffix()
returns text language sql volatile as $$
  select upper(substr(md5(gen_random_uuid()::text), 1, 4))
$$;

create or replace function slugify(input text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function ensure_workspace_join(p_workspace_id uuid, p_org_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_base text;
  v_code text;
  v_slug text;
  v_attempt int := 0;
begin
  if exists (select 1 from workspace_join where workspace_id = p_workspace_id) then
    return;
  end if;
  v_base := upper(left(regexp_replace(coalesce(p_org_name, 'WORKSPACE'), '[^a-zA-Z]', '', 'g'), 6));
  if v_base = '' then v_base := 'JOIN'; end if;
  loop
    v_code := v_base || '-' || random_join_suffix();
    v_slug := slugify(p_org_name) || '-' || lower(substr(md5(random()::text), 1, 3));
    v_attempt := v_attempt + 1;
    begin
      insert into workspace_join (workspace_id, code, slug) values (p_workspace_id, v_code, v_slug);
      return;
    exception when unique_violation then
      if v_attempt > 5 then raise; end if;
    end;
  end loop;
end $$;

-- Regenerate just the code (link/slug stays stable so previously-shared URLs
-- keep working). Manager-only, enforced inside the function (defense in
-- depth — SECURITY DEFINER bypasses table RLS, so this checks explicitly).
create or replace function regenerate_join_code(p_workspace_id uuid, p_org_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_base text;
  v_code text;
  v_attempt int := 0;
begin
  if p_workspace_id <> current_workspace() or not current_role_is(array['manager']::role[]) then
    raise exception 'insufficient_privilege';
  end if;
  v_base := upper(left(regexp_replace(coalesce(p_org_name, 'WORKSPACE'), '[^a-zA-Z]', '', 'g'), 6));
  if v_base = '' then v_base := 'JOIN'; end if;
  loop
    v_code := v_base || '-' || random_join_suffix();
    v_attempt := v_attempt + 1;
    begin
      update workspace_join set code = v_code, updated_at = now() where workspace_id = p_workspace_id;
      return v_code;
    exception when unique_violation then
      if v_attempt > 5 then raise; end if;
    end;
  end loop;
end $$;

grant execute on function regenerate_join_code(uuid, text) to authenticated;

-- =====================================================================
-- 2. Pre-signup domain check (public RPC — no auth yet)
-- =====================================================================
-- Lets the signup wizard show the right branch screen — and, critically,
-- the PM/Developer role picker — BEFORE the account is created, matching
-- the design exactly without needing a "role chosen later" transient state.
create or replace function check_signup_domain(p_email text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_domain text := lower(split_part(p_email, '@', 2));
  v_ws record;
  v_manager text;
begin
  if v_domain = '' or is_personal_domain(v_domain) then
    return jsonb_build_object('branch', 'personal');
  end if;

  select w.id, w.name into v_ws from workspaces w where w.domain = v_domain limit 1;
  if v_ws.id is null then
    return jsonb_build_object('branch', 'first', 'org_name', initcap(split_part(v_domain, '.', 1)));
  end if;

  select p.name into v_manager from profiles p where p.workspace_id = v_ws.id and p.role = 'manager' limit 1;
  return jsonb_build_object('branch', 'subsequent', 'org_name', v_ws.name, 'manager_name', v_manager);
end $$;

grant execute on function check_signup_domain(text) to anon, authenticated;

-- =====================================================================
-- 3. handle_new_user: add the join_code/join_slug path, auto-provision
--    workspace_join for new workspaces
-- =====================================================================
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
begin
  if exists (select 1 from profiles where auth_uid = new.id) then
    return new;
  end if;

  v_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_invite_code := new.raw_user_meta_data->>'invite_code';
  v_join_key := coalesce(new.raw_user_meta_data->>'join_code', new.raw_user_meta_data->>'join_slug');

  -- Path 0: end-user join code or invite link → always role=customer, active,
  -- attached to exactly one workspace. Distinct persona — never touches
  -- domain/role logic below.
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

  -- Path 1: staff invite link (Stakeholder only, generated in Team & Members).
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

  -- Path 2: domain-based staff provisioning. The frontend runs
  -- check_signup_domain() first and, for the "subsequent" branch, always
  -- sends an explicit pm/developer choice — this clamp is a safety net for
  -- providers where we can't intercept before account creation (Google SSO).
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

-- Backfill: give every existing workspace a join code/link.
do $$
declare r record;
begin
  for r in select w.id, w.name from workspaces w
           where not exists (select 1 from workspace_join j where j.workspace_id = w.id)
  loop
    perform ensure_workspace_join(r.id, r.name);
  end loop;
end $$;

-- =====================================================================
-- 4. Security fix: profiles_self_update currently has no column
--    restriction — any authenticated user could set their OWN role to
--    'manager' or status to 'active' directly. Block self-serve changes
--    to role/status (managers may still change their own — they already
--    hold that role; and this never blocks a manager changing SOMEONE
--    ELSE's row, which is a different auth_uid and goes through
--    profiles_admin_update instead).
-- =====================================================================
create or replace function prevent_self_role_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.auth_uid = auth.uid()
     and (new.role is distinct from old.role or new.status is distinct from old.status)
     and not current_role_is(array['manager']::role[]) then
    raise exception 'insufficient_privilege: cannot change your own role or status';
  end if;
  return new;
end $$;

drop trigger if exists trg_prevent_self_role_escalation on profiles;
create trigger trg_prevent_self_role_escalation
  before update on profiles
  for each row execute function prevent_self_role_escalation();

-- =====================================================================
-- 5. Bug fix: notifications had no INSERT policy at all, so any direct
--    client insert (already shipped: role-change notify, approve/decline
--    notify in Team & Members) was silently rejected by RLS. Allow any
--    workspace member to notify another member of the same workspace.
-- =====================================================================
drop policy if exists notif_insert on notifications;
create policy notif_insert on notifications for insert
  with check (user_id in (select id from profiles where workspace_id = current_workspace()));
