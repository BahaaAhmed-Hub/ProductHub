// ProductHub — list the connected Asana account's workspaces + projects, so
// the UI can offer a project picker before the first sync.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requireManager } from '../_shared/authedClient.ts';
import { asanaFetch, ensureFreshToken } from '../_shared/asana.ts';

interface AsanaWorkspace {
  gid: string;
  name: string;
}
interface AsanaProject {
  gid: string;
  name: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = authedClient(req);
  if (!supabase) return json({ error: 'Missing Authorization header.' }, 401);

  const caller = await requireManager(supabase);
  if (!caller) return json({ error: 'Only a workspace Manager can view integration settings.' }, 403);

  const { data: connection, error } = await supabase
    .from('integration_connections')
    .select('id, access_token, refresh_token, expires_at')
    .eq('workspace_id', caller.workspaceId)
    .eq('provider', 'asana')
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!connection) return json({ error: 'Asana is not connected for this workspace.' }, 404);

  try {
    const accessToken = await ensureFreshToken(supabase, connection);
    const workspaces = (await asanaFetch(accessToken, '/workspaces')) as AsanaWorkspace[];

    const perWorkspace = await Promise.all(
      workspaces.map(async (ws) => ({
        gid: ws.gid,
        name: ws.name,
        projects: (await asanaFetch(
          accessToken,
          `/projects?workspace=${ws.gid}&archived=false&limit=100`,
        )) as AsanaProject[],
      })),
    );

    return json({ workspaces: perWorkspace });
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
