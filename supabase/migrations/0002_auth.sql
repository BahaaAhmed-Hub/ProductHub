-- ProductHub — auth wiring (self-serve, no seed data)
-- Idempotent. Replaces the earlier demo-seed migration.
--
-- On every new signup (Google OAuth or email), auto-provision the user's OWN
-- org + workspace and a profile — true multi-vendor self-serve onboarding.

-- Allow a member to archive their own requests (staff: any in workspace).
drop policy if exists requests_delete on requests;
create policy requests_delete on requests for delete
  using (
    workspace_id = current_workspace()
    and (
      submitted_by = (select id from profiles where auth_uid = auth.uid())
      or current_role_is(array['developer','pm','manager']::role[])
    )
  );

-- Provision a fresh workspace + profile for each new auth user.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_ws uuid;
  v_name text;
begin
  if exists (select 1 from profiles where auth_uid = new.id) then
    return new;
  end if;

  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into orgs (name, plan)
    values (coalesce(nullif(split_part(new.email, '@', 2), ''), 'Personal'), 'free')
    returning id into v_org;

  insert into workspaces (org_id, name)
    values (v_org, v_name || '''s workspace')
    returning id into v_ws;

  insert into profiles (auth_uid, workspace_id, name, email, role, avatar_url)
    values (
      new.id,
      v_ws,
      v_name,
      new.email,
      coalesce((new.raw_user_meta_data->>'role')::role, 'customer'),
      new.raw_user_meta_data->>'avatar_url'
    );

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
