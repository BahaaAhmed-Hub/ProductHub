// ProductHub — platform-admin-triggered password reset for a tenant user.
// A real reset (Supabase Admin's generateLink), not a stub: generates a
// genuine one-time recovery link and emails it via Supabase Auth's normal
// recovery flow, service role (see _shared/adminClient.ts).
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requirePlatformAdmin } from '../_shared/authedClient.ts';
import { adminClient } from '../_shared/adminClient.ts';

interface Body {
  email: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = authedClient(req);
  if (!supabase) return json({ error: 'Missing Authorization header.' }, 401);

  const caller = await requirePlatformAdmin(supabase);
  if (!caller) return json({ error: 'Platform admin access required.' }, 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const email = body.email?.trim().toLowerCase();
  if (!email) return json({ error: 'Missing "email".' }, 400);

  try {
    const admin = adminClient();
    const { error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
    if (error) return json({ error: error.message }, 502);
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
