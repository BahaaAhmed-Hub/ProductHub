-- ProductHub — fix infinite recursion in profiles RLS.
--
-- The profiles policies reference current_workspace()/current_role_is(), which
-- read from profiles. As SECURITY INVOKER functions they re-trigger the profiles
-- RLS policy → "infinite recursion detected in policy for relation profiles",
-- so an authenticated user's own profile lookup errors out and the app bounces
-- back to sign-in. Recreating the helpers as SECURITY DEFINER makes them bypass
-- RLS, breaking the loop. Also add a direct self-read policy as a belt-and-suspenders.

create or replace function current_profile()
returns profiles
language sql stable security definer set search_path = public
as $$ select * from profiles where auth_uid = auth.uid() limit 1 $$;

create or replace function current_workspace()
returns uuid
language sql stable security definer set search_path = public
as $$ select workspace_id from profiles where auth_uid = auth.uid() limit 1 $$;

create or replace function current_role_is(target role[])
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from profiles where auth_uid = auth.uid() and role = any(target)
) $$;

-- A user can always read their own profile row directly (no function call).
drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles for select
  using (auth_uid = auth.uid());
