-- ProductHub — seed + auth wiring (run AFTER 0001_init.sql)
-- Idempotent: safe to run more than once.
--
-- Creates: the Orion Cloud demo workspace, 3 pre-confirmed demo logins
-- (customer/developer/pm @orioncloud.com, password 'producthub123'), sample
-- requests, a signup trigger that auto-provisions a profile, and a delete
-- (archive) policy for requests.

-- ---------- allow customers to archive their own requests (staff: any) ----------
drop policy if exists requests_delete on requests;
create policy requests_delete on requests for delete
  using (
    workspace_id = current_workspace()
    and (
      submitted_by = (select id from profiles where auth_uid = auth.uid())
      or current_role_is(array['developer','pm','manager']::role[])
    )
  );

-- ---------- auto-provision a profile when a new auth user signs up ----------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_ws uuid;
begin
  select id into v_ws from workspaces where name = 'Orion Cloud' limit 1;
  if v_ws is not null and not exists (select 1 from profiles where auth_uid = new.id) then
    insert into profiles (auth_uid, workspace_id, name, email, role)
    values (
      new.id,
      v_ws,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      new.email,
      coalesce((new.raw_user_meta_data->>'role')::role, 'customer')
    );
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- seed workspace, demo users, sample requests ----------
do $$
declare
  v_org uuid;
  v_ws uuid;
  rec record;
  v_uid uuid;
  v_customer_pid uuid;
begin
  -- Org + workspace
  select id into v_ws from workspaces where name = 'Orion Cloud' limit 1;
  if v_ws is null then
    insert into orgs (name, plan) values ('Orion Cloud Inc', 'pro') returning id into v_org;
    insert into workspaces (org_id, name) values (v_org, 'Orion Cloud') returning id into v_ws;
  end if;

  -- Demo auth users (pre-confirmed so login works without email/SMTP)
  for rec in
    select * from (values
      ('customer@orioncloud.com', 'Maya T.',  'customer'),
      ('developer@orioncloud.com','Sara K.',  'developer'),
      ('pm@orioncloud.com',       'Nour M.',  'pm')
    ) as t(email, name, role)
  loop
    select id into v_uid from auth.users where email = rec.email limit 1;
    if v_uid is null then
      v_uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        rec.email, crypt('producthub123', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', rec.name, 'role', rec.role),
        '', '', '', ''
      );
      insert into auth.identities (
        provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        v_uid::text, v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', rec.email),
        'email', now(), now(), now()
      );
    end if;

    -- Profile (the signup trigger may already have created it; guard anyway)
    if not exists (select 1 from profiles where auth_uid = v_uid) then
      insert into profiles (auth_uid, workspace_id, name, email, role)
      values (v_uid, v_ws, rec.name, rec.email, rec.role::role);
    end if;

    if rec.role = 'customer' then
      select id into v_customer_pid from profiles where auth_uid = v_uid;
    end if;
  end loop;

  -- Sample requests (only if the workspace has none yet)
  if not exists (select 1 from requests where workspace_id = v_ws) then
    insert into requests (workspace_id, ref, type, subject, description, priority, product, status, submitted_by, created_at) values
      (v_ws, 'BUG-0042', 'bug', 'API rate limit not applying to enterprise tier',
        'Seeing 429s on the enterprise plan even though we''re well under quota. Started after the Tuesday deploy.',
        'high', 'API Gateway', 'in_development', v_customer_pid, now() - interval '3 days'),
      (v_ws, 'FEAT-0024', 'feature', 'SSO integration with Azure AD',
        'Need SAML SSO against Azure AD for our security review.',
        'high', 'Platform', 'in_development', v_customer_pid, now() - interval '6 days'),
      (v_ws, 'BUG-0038', 'bug', 'Export to CSV missing timezone column',
        'CSV export drops the timezone column present in the UI table.',
        'medium', 'Reports', 'submitted', v_customer_pid, now() - interval '4 days'),
      (v_ws, 'QRY-0014', 'query', 'How to configure role-based access for sub-accounts?',
        'Looking for docs on RBAC across sub-accounts.',
        'low', 'Platform', 'closed', v_customer_pid, now() - interval '8 days'),
      (v_ws, 'QRY-0017', 'query', 'Can we get a dedicated instance in EU region?',
        'Data residency requirement for EU customers.',
        'low', 'Infrastructure', 'submitted', v_customer_pid, now() - interval '10 days');
  end if;
end $$;
