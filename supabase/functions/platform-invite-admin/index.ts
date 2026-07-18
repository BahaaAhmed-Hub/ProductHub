// ProductHub — invite a new internal platform admin (ProductHub-Admin
// console). Platform-Owner-gated. Mirrors invite-member's pattern exactly
// (Admin API inviteUserByEmail via service role — see _shared/adminClient.ts)
// but sets platform_admin_role in user_metadata instead of
// member_invite_role/workspace_id, so handle_new_user() provisions a
// platform_admins row instead of a tenant profile.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requirePlatformOwner } from '../_shared/authedClient.ts';
import { adminClient } from '../_shared/adminClient.ts';

const PLATFORM_ROLES = ['Platform Owner', 'Billing Admin', 'IT / Security Admin', 'Support Ops'];

interface Body {
  name: string;
  email: string;
  role: string;
  redirectTo: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = authedClient(req);
  if (!supabase) return json({ error: 'Missing Authorization header.' }, 401);

  const caller = await requirePlatformOwner(supabase);
  if (!caller) return json({ error: 'Only a Platform Owner can invite internal admins.' }, 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  if (!email || !name || !body.role || !body.redirectTo) {
    return json({ error: 'Missing "name", "email", "role", or "redirectTo".' }, 400);
  }
  if (!PLATFORM_ROLES.includes(body.role)) return json({ error: 'Invalid role.' }, 400);

  try {
    const admin = adminClient();
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name, platform_admin_role: body.role },
      redirectTo: body.redirectTo,
    });
    if (error) {
      const msg = /already registered|already exists/i.test(error.message)
        ? "This email already has an account elsewhere and can't be invited here."
        : error.message;
      return json({ error: msg }, 409);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
