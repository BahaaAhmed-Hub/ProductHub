-- ProductHub — honor an invite code at signup: join that exact workspace with
-- the invited role, active immediately (no pending approval — a manager
-- explicitly created the invite). Falls back to the existing domain-based
-- logic (0008) when no valid invite_code is present. Idempotent.

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
begin
  if exists (select 1 from profiles where auth_uid = new.id) then
    return new;
  end if;

  v_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_invite_code := new.raw_user_meta_data->>'invite_code';

  -- Path 1: valid invite code → join that workspace with the invited role, active.
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

  -- Path 2 (fallback): domain-based provisioning (see 0008 for full comments).
  v_domain := lower(split_part(new.email, '@', 2));
  v_req := case
    when (new.raw_user_meta_data->>'role') in ('customer','developer','pm','manager','stakeholder')
    then (new.raw_user_meta_data->>'role')::role else 'customer'::role end;

  if v_domain = '' or is_personal_domain(v_domain) then
    insert into orgs(name, plan) values (v_name, 'free') returning id into v_org;
    insert into workspaces(org_id, name) values (v_org, v_name || '''s workspace') returning id into v_ws;
    insert into profiles(auth_uid, workspace_id, name, email, role, status, requested_role, avatar_url)
      values (new.id, v_ws, v_name, new.email, 'manager', 'active', 'manager', new.raw_user_meta_data->>'avatar_url');
    return new;
  end if;

  select id into v_ws from workspaces where domain = v_domain limit 1;
  v_org_name := initcap(split_part(v_domain, '.', 1));

  if v_ws is null then
    insert into orgs(name, plan) values (v_org_name, 'free') returning id into v_org;
    insert into workspaces(org_id, name, domain) values (v_org, v_org_name, v_domain) returning id into v_ws;
    insert into profiles(auth_uid, workspace_id, name, email, role, status, requested_role, avatar_url)
      values (new.id, v_ws, v_name, new.email, 'manager', 'active', 'manager', new.raw_user_meta_data->>'avatar_url');
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
