-- ProductHub — allow a user to update their own profile.
--
-- Enables the owner "switch role" control (and future profile editing). Scoped
-- strictly to the caller's own row. In a fuller build, role changes would be
-- gated to admins/invites; for now the single-owner workspace can self-select
-- which role surface to operate in.

drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles for update
  using (auth_uid = auth.uid())
  with check (auth_uid = auth.uid());
