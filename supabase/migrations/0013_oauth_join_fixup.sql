-- ProductHub — fixup RPC for Google-OAuth signups that carried a pending
-- join code / invite code. Google's OAuth flow can't pass our custom
-- user_metadata pre-creation, so handle_new_user() falls through to the
-- domain-based staff path for these signups. The frontend stashes the key
-- in sessionStorage before the redirect and calls this RPC right after the
-- session resolves, to re-home the freshly-created profile onto the
-- intended workspace with the correct role/status.

create or replace function apply_pending_join(p_key text, p_kind text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile record;
  v_join record;
  v_invite record;
begin
  select * into v_profile from profiles where auth_uid = auth.uid();
  if not found then
    return jsonb_build_object('applied', false, 'reason', 'no_profile');
  end if;

  -- Safety net: only re-home a profile created moments ago by this exact
  -- flow, never an established account acting on a stray sessionStorage key.
  if v_profile.created_at < now() - interval '10 minutes' then
    return jsonb_build_object('applied', false, 'reason', 'too_old');
  end if;

  if p_kind = 'join' then
    select * into v_join from workspace_join
      where code = upper(p_key) or slug = lower(p_key)
      limit 1;
    if not found then
      return jsonb_build_object('applied', false, 'reason', 'not_found');
    end if;
    update profiles set
      workspace_id = v_join.workspace_id,
      role = 'customer',
      status = 'active',
      requested_role = 'customer'
      where auth_uid = auth.uid();
    return jsonb_build_object('applied', true);
  elsif p_kind = 'invite' then
    select * into v_invite from workspace_invites
      where code = p_key and not revoked
        and (expires_at is null or expires_at > now())
      limit 1;
    if not found then
      return jsonb_build_object('applied', false, 'reason', 'not_found');
    end if;
    update profiles set
      workspace_id = v_invite.workspace_id,
      role = v_invite.role,
      status = 'active',
      requested_role = v_invite.role
      where auth_uid = auth.uid();
    return jsonb_build_object('applied', true);
  end if;

  return jsonb_build_object('applied', false, 'reason', 'bad_kind');
end $$;

grant execute on function apply_pending_join(text, text) to authenticated;
