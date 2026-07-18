// ProductHub — invite a new team member by email + role (Developer/PM/
// Manager/Stakeholder). Uses Supabase Admin's inviteUserByEmail (service
// role — see _shared/adminClient.ts) to create an unconfirmed auth user and
// send them a "set your password" email. handle_new_user() provisions the
// profile immediately (status='invited'); calling this again for the same
// still-unconfirmed email resends the invite rather than erroring, so this
// one function backs both the "Invite" and "Resend" actions in Team & Members.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requireManager } from '../_shared/authedClient.ts';
import { adminClient } from '../_shared/adminClient.ts';

const INVITABLE_ROLES = ['developer', 'pm', 'manager', 'stakeholder'];

interface Body {
  email: string;
  role: string;
  redirectTo: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = authedClient(req);
  if (!supabase) return json({ error: 'Missing Authorization header.' }, 401);

  const caller = await requireManager(supabase);
  if (!caller) return json({ error: 'Only a workspace Manager can invite members.' }, 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const email = body.email?.trim().toLowerCase();
  if (!email || !body.role || !body.redirectTo) {
    return json({ error: 'Missing "email", "role", or "redirectTo".' }, 400);
  }
  if (!INVITABLE_ROLES.includes(body.role)) {
    return json({ error: 'Invalid role.' }, 400);
  }

  try {
    // A clearer message than the Admin API's generic "already registered"
    // for the common case: this person is already active in this workspace.
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, status')
      .eq('email', email)
      .eq('workspace_id', caller.workspaceId)
      .maybeSingle();
    if (existing && existing.status === 'active') {
      return json({ error: 'This person is already an active member of your workspace.' }, 409);
    }

    const admin = adminClient();
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { member_invite_role: body.role, member_invite_workspace_id: caller.workspaceId },
      redirectTo: body.redirectTo,
    });

    if (error) {
      const msg = /already registered|already exists/i.test(error.message)
        ? "This email already has an account elsewhere and can't be invited here."
        : error.message;
      return json({ error: msg }, 409);
    }

    // Keep invited_at fresh on resend (handle_new_user only sets it once, on
    // first insert) so "hasn't responded in a while" reflects the latest nudge.
    if (existing) {
      await supabase.from('profiles').update({ invited_at: new Date().toISOString() }).eq('id', existing.id);
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
