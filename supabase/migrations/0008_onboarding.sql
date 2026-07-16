-- ProductHub — domain-based onboarding + role approval. Idempotent.
--
-- Personal email  → own workspace, highest role (manager/owner), active.
-- Company domain  → first user creates the shared workspace as admin (manager);
--                   later users pick a role but land 'pending' + role=customer
--                   until a manager in that domain approves (→ requested role)
--                   or declines (→ stays customer). Managers are notified.

alter table workspaces add column if not exists domain text;
create unique index if not exists workspaces_domain_uniq on workspaces(domain) where domain is not null;

alter table profiles add column if not exists status text not null default 'active';
alter table profiles add column if not exists requested_role role;

create or replace function is_personal_domain(d text) returns boolean
language sql immutable as $$
  select d = any(array[
    'gmail.com','googlemail.com','outlook.com','hotmail.com','live.com','msn.com',
    'yahoo.com','ymail.com','icloud.com','me.com','mac.com','proton.me','protonmail.com',
    'pm.me','aol.com','mail.com','gmx.com','gmx.de','yandex.com','zoho.com','hey.com'
  ])
$$;

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_domain text;
  v_name text;
  v_req role;
  v_org uuid;
  v_ws uuid;
  v_org_name text;
begin
  if exists (select 1 from profiles where auth_uid = new.id) then
    return new;
  end if;

  v_domain := lower(split_part(new.email, '@', 2));
  v_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_req := case
    when (new.raw_user_meta_data->>'role') in ('customer','developer','pm','manager','stakeholder')
    then (new.raw_user_meta_data->>'role')::role else 'customer'::role end;

  -- Personal / unknown domain → solo owner (highest role), active.
  if v_domain = '' or is_personal_domain(v_domain) then
    insert into orgs(name, plan) values (v_name, 'free') returning id into v_org;
    insert into workspaces(org_id, name) values (v_org, v_name || '''s workspace') returning id into v_ws;
    insert into profiles(auth_uid, workspace_id, name, email, role, status, requested_role, avatar_url)
      values (new.id, v_ws, v_name, new.email, 'manager', 'active', 'manager', new.raw_user_meta_data->>'avatar_url');
    return new;
  end if;

  -- Company domain.
  select id into v_ws from workspaces where domain = v_domain limit 1;
  v_org_name := initcap(split_part(v_domain, '.', 1));

  if v_ws is null then
    -- First user of the domain → admin (manager), active.
    insert into orgs(name, plan) values (v_org_name, 'free') returning id into v_org;
    insert into workspaces(org_id, name, domain) values (v_org, v_org_name, v_domain) returning id into v_ws;
    insert into profiles(auth_uid, workspace_id, name, email, role, status, requested_role, avatar_url)
      values (new.id, v_ws, v_name, new.email, 'manager', 'active', 'manager', new.raw_user_meta_data->>'avatar_url');
  else
    -- Subsequent user → pending, effective role customer until approved.
    insert into profiles(auth_uid, workspace_id, name, email, role, status, requested_role, avatar_url)
      values (new.id, v_ws, v_name, new.email, 'customer', 'pending', v_req, new.raw_user_meta_data->>'avatar_url');
    -- Notify the domain admins.
    insert into notifications(user_id, kind, title, body)
      select p.id, 'approval', v_name || ' requested ' || v_req || ' access',
             new.email || ' is waiting for approval in ' || v_org_name
      from profiles p
      where p.workspace_id = v_ws and p.role = 'manager';
  end if;
  return new;
end $$;

-- Managers can update other profiles in their workspace (approve/decline).
drop policy if exists profiles_admin_update on profiles;
create policy profiles_admin_update on profiles for update
  using (workspace_id = current_workspace() and current_role_is(array['manager']::role[]))
  with check (workspace_id = current_workspace());

-- Upgrade any existing solo-workspace member to owner (manager/active) so current
-- accounts (e.g. a personal-Gmail signup that landed as customer) become admins.
update profiles set role = 'manager'
where role <> 'manager'
  and workspace_id in (select workspace_id from profiles group by workspace_id having count(*) = 1);
