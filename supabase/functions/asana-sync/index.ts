// ProductHub — one-way import: pull tasks from the connected Asana project
// into the shared backlog. Manual trigger (v1) — re-running is safe, tasks
// upsert on (workspace_id, external_source, external_id).
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requireManager } from '../_shared/authedClient.ts';
import { asanaFetchAllPages, ensureFreshToken } from '../_shared/asana.ts';

interface AsanaTask {
  gid: string;
  name: string;
  notes: string | null;
  completed: boolean;
  permalink_url: string | null;
}

function refFor(gid: string): string {
  // Short, stable, and visually distinct from organically-created refs
  // (FEAT-/BUG-/TASK-) without needing a per-workspace sequence counter.
  return `ASN-${gid.slice(-6).toUpperCase()}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = authedClient(req);
  if (!supabase) return json({ error: 'Missing Authorization header.' }, 401);

  const caller = await requireManager(supabase);
  if (!caller) return json({ error: 'Only a workspace Manager can sync integrations.' }, 403);

  const { data: connection, error } = await supabase
    .from('integration_connections')
    .select('id, access_token, refresh_token, expires_at, external_project_gid')
    .eq('workspace_id', caller.workspaceId)
    .eq('provider', 'asana')
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!connection) return json({ error: 'Asana is not connected for this workspace.' }, 404);
  if (!connection.external_project_gid) return json({ error: 'Pick an Asana project to sync first.' }, 400);

  try {
    const accessToken = await ensureFreshToken(supabase, connection);
    const tasks = await asanaFetchAllPages<AsanaTask>(
      accessToken,
      `/projects/${connection.external_project_gid}/tasks?opt_fields=name,notes,completed,permalink_url&limit=100`,
    );

    const rows = tasks.map((t) => ({
      workspace_id: caller.workspaceId,
      ref: refFor(t.gid),
      title: t.name || '(untitled Asana task)',
      description: t.notes || '',
      type: 'feature' as const,
      // Asana's only universal signal without custom-field lookups is
      // completion — a coarse v1 mapping, refined once status sync matters.
      board_status: t.completed ? 'released' : 'triaged',
      external_source: 'asana',
      external_id: t.gid,
    }));

    let imported = 0;
    if (rows.length > 0) {
      // ref is a pure function of the Asana gid, so re-including it on every
      // upsert is safe — it recomputes to the same value each time rather
      // than drifting the way a counter-assigned ref would.
      const { data, error: upsertError } = await supabase
        .from('backlog_items')
        .upsert(rows, { onConflict: 'workspace_id,external_source,external_id' })
        .select('id');
      if (upsertError) return json({ error: upsertError.message }, 500);
      imported = data?.length ?? 0;
    }

    await supabase
      .from('integration_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id);

    return json({ imported, total: tasks.length });
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
