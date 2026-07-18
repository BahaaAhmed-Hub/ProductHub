-- ProductHub — direct email invites for Team & Members (Developer/PM/Manager/
-- Stakeholder). A manager types an email + role in the Team screen; a new
-- Edge Function (invite-member) calls Supabase Admin's inviteUserByEmail
-- (service role key, not exposed to the browser), which creates an
-- unconfirmed auth user and emails them a "set your password" link.
--
-- handle_new_user() fires immediately on that admin-created auth.users insert
-- (before the person ever opens the email), so we provision the profile right
-- away with status='invited' — the manager sees them in the roster instantly.
-- Once they follow the email link, set a password, and sign in,
-- activate_invited_profile() flips status to 'active'. Idempotent.

alter table profiles add column if not exists invited_at timestamptz;

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
begin
  if exists (select 1 from profiles where auth_uid = new.id) then
    return new;
  end if;

  v_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_member_role := new.raw_user_meta_data->>'member_invite_role';
  v_member_ws := nullif(new.raw_user_meta_data->>'member_invite_workspace_id', '')::uuid;

  -- Path -1: direct email invite from Team & Members — always joins that
  -- exact workspace with that exact role, starting 'invited' until the
  -- person sets a password and signs in. Takes priority over everything
  -- else since a manager explicitly chose this person's role.
  if v_member_role is not null and v_member_ws is not null then
    insert into profiles(auth_uid, workspace_id, name, email, role, status, requested_role, invited_at, avatar_url)
      values (new.id, v_member_ws, v_name, new.email, v_member_role::role, 'invited', v_member_role::role, now(),
              new.raw_user_meta_data->>'avatar_url');
    return new;
  end if;

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

-- Flips an invited profile to 'active' once the person has set a password
-- and is signed in. SECURITY DEFINER + auth.uid() scoping: only the invited
-- person themselves (never another workspace member) can activate their own row.
create or replace function activate_invited_profile()
returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set status = 'active' where auth_uid = auth.uid() and status = 'invited';
end $$;

grant execute on function activate_invited_profile() to authenticated;

-- prevent_self_role_escalation (0011) blocks a user from changing their own
-- role/status unless they're already a manager — which would also block the
-- update above, since an invited developer/pm/stakeholder isn't a manager
-- yet. Carve out exactly the invited→active self-transition (role unchanged)
-- as a non-escalating exception; everything else it blocked still is.
create or replace function prevent_self_role_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.auth_uid = auth.uid()
     and (new.role is distinct from old.role or new.status is distinct from old.status)
     and not current_role_is(array['manager']::role[])
     and not (old.status = 'invited' and new.status = 'active' and new.role = old.role)
  then
    raise exception 'insufficient_privilege: cannot change your own role or status';
  end if;
  return new;
end $$;
