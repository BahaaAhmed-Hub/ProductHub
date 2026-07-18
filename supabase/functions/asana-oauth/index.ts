// ProductHub — Asana OAuth: authorize-URL issuance + code exchange.
// Deno Edge Function. Invoked via supabase.functions.invoke('asana-oauth').
// Client secret stays here — the browser only ever sees the authorize URL
// and, on return, a short-lived authorization code.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requireManager } from '../_shared/authedClient.ts';
import { buildAuthorizeUrl, exchangeCode } from '../_shared/asana.ts';

interface Body {
  action: 'authorize' | 'callback';
  redirectUri: string;
  code?: string; // callback only
  state?: string; // callback only — echoed back for the caller's own CSRF check
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = authedClient(req);
  if (!supabase) return json({ error: 'Missing Authorization header.' }, 401);

  const caller = await requireManager(supabase);
  if (!caller) return json({ error: 'Only a workspace Manager can connect integrations.' }, 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  if (!body.redirectUri) return json({ error: 'Missing "redirectUri".' }, 400);

  try {
    if (body.action === 'authorize') {
      const state = `asana:${crypto.randomUUID()}`;
      const url = buildAuthorizeUrl(body.redirectUri, state);
      return json({ url, state });
    }

    if (body.action === 'callback') {
      if (!body.code) return json({ error: 'Missing "code".' }, 400);
      const tokens = await exchangeCode(body.code, body.redirectUri);
      const expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const { error } = await supabase.from('integration_connections').upsert(
        {
          workspace_id: caller.workspaceId,
          provider: 'asana',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at,
          connected_by: caller.id,
          connected_at: new Date().toISOString(),
          // A reconnect clears any previously-chosen project — the new
          // grant may not even cover the old one.
          external_workspace_gid: null,
          external_workspace_name: null,
          external_project_gid: null,
          external_project_name: null,
        },
        { onConflict: 'workspace_id,provider' },
      );
      if (error) return json({ error: error.message }, 500);
      return json({ connected: true });
    }

    return json({ error: 'Unknown action.' }, 400);
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
