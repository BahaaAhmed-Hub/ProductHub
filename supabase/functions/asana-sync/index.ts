// ProductHub — one-way import: pull tasks, comments, owners, and status
// from the connected Asana project into the shared backlog. Manual trigger
// (v1) — re-running is safe, tasks upsert on
// (workspace_id, external_source, external_id), comments on
// (item_id, external_source, external_id).
//
// Field mapping: board_status/priority/type are driven by
// integration_field_mappings when a Manager has configured one (source
// field -> target field -> { Asana option label: ProductHub value }); with
// no mapping configured, board_status falls back to the completed
// heuristic and priority/type fall back to their column defaults. Because
// Asana is treated as the source of truth for a synced project, an unmapped
// field is still written on every sync (not left alone) — a manual edit in
// ProductHub to a synced item's priority/type/status will be overwritten by
// the next sync unless a mapping is configured to preserve it intentionally.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requireManager } from '../_shared/authedClient.ts';
import { asanaFetchAllPages, ensureFreshToken, mapConcurrent } from '../_shared/asana.ts';

interface AsanaCustomFieldValue {
  gid: string;
  enum_value: { name: string } | null;
}
interface AsanaTask {
  gid: string;
  name: string;
  notes: string | null;
  completed: boolean;
  assignee: { name: string; email: string } | null;
  memberships: { section: { name: string } | null }[];
  custom_fields: AsanaCustomFieldValue[];
}
interface AsanaStory {
  gid: string;
  type: string; // 'comment' | 'system'
  text: string;
  created_by: { name: string; email: string } | null;
}
interface FieldMapping {
  source_field: string;
  target_field: 'board_status' | 'priority' | 'type' | 'ignore';
  value_map: Record<string, string>;
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

    const [tasks, mappingRows, profileRows] = await Promise.all([
      asanaFetchAllPages<AsanaTask>(
        accessToken,
        `/projects/${connection.external_project_gid}/tasks` +
          `?opt_fields=name,notes,completed,assignee.name,assignee.email,memberships.section.name,` +
          `custom_fields.gid,custom_fields.enum_value.name&limit=100`,
      ),
      supabase
        .from('integration_field_mappings')
        .select('source_field, target_field, value_map')
        .eq('workspace_id', caller.workspaceId)
        .eq('provider', 'asana')
        .then((r) => (r.data ?? []) as FieldMapping[]),
      supabase
        .from('profiles')
        .select('id, email')
        .eq('workspace_id', caller.workspaceId)
        .then((r) => (r.data ?? []) as { id: string; email: string }[]),
    ]);

    const mappingBySource = new Map(mappingRows.map((m) => [m.source_field, m]));
    const profileByEmail = new Map(profileRows.map((p) => [p.email.toLowerCase(), p.id]));

    const rows = tasks.map((t) => {
      let board_status: string | undefined;
      const sectionMapping = mappingBySource.get('__section__');
      const sectionName = t.memberships?.[0]?.section?.name;
      if (sectionMapping?.target_field === 'board_status' && sectionName) {
        board_status = sectionMapping.value_map[sectionName];
      }

      let priority: string | undefined;
      let type: string | undefined;
      for (const cf of t.custom_fields ?? []) {
        const m = mappingBySource.get(cf.gid);
        const label = cf.enum_value?.name;
        if (!m || !label) continue;
        const mapped = m.value_map[label];
        if (!mapped) continue;
        if (m.target_field === 'board_status') board_status = mapped;
        else if (m.target_field === 'priority') priority = mapped;
        else if (m.target_field === 'type') type = mapped;
      }
      // No mapping matched (or none configured) — fall back to the only
      // universal signal Asana gives every task for free.
      if (!board_status) board_status = t.completed ? 'released' : 'triaged';

      const assigneeEmail = t.assignee?.email?.toLowerCase();
      const assignee_id = assigneeEmail ? (profileByEmail.get(assigneeEmail) ?? null) : null;
      const external_assignee_name = !assignee_id && t.assignee ? t.assignee.name : null;

      return {
        workspace_id: caller.workspaceId,
        ref: refFor(t.gid),
        title: t.name || '(untitled Asana task)',
        description: t.notes || '',
        type: type ?? 'feature',
        board_status,
        priority: priority ?? 'medium',
        assignee_id,
        external_assignee_name,
        external_source: 'asana',
        external_id: t.gid,
      };
    });

    let imported = 0;
    let itemIdByTaskGid = new Map<string, string>();
    if (rows.length > 0) {
      // ref is a pure function of the Asana gid, so re-including it on every
      // upsert is safe — it recomputes to the same value each time rather
      // than drifting the way a counter-assigned ref would.
      const { data, error: upsertError } = await supabase
        .from('backlog_items')
        .upsert(rows, { onConflict: 'workspace_id,external_source,external_id' })
        .select('id, external_id');
      if (upsertError) return json({ error: upsertError.message }, 500);
      imported = data?.length ?? 0;
      itemIdByTaskGid = new Map((data ?? []).map((r: { id: string; external_id: string }) => [r.external_id, r.id]));
    }

    // Comments — one API call per task, bounded concurrency to stay under
    // Asana's rate limits on larger projects.
    let commentsImported = 0;
    const storyLists = await mapConcurrent(tasks, 5, (t) =>
      asanaFetchAllPages<AsanaStory>(accessToken, `/tasks/${t.gid}/stories?opt_fields=type,text,created_by.name,created_by.email`).catch(
        () => [] as AsanaStory[],
      ),
    );
    const noteRows = tasks.flatMap((t, i) => {
      const itemId = itemIdByTaskGid.get(t.gid);
      if (!itemId) return [];
      return storyLists[i]
        .filter((s) => s.type === 'comment' && s.text)
        .map((s) => {
          const email = s.created_by?.email?.toLowerCase();
          return {
            item_id: itemId,
            author_id: email ? (profileByEmail.get(email) ?? null) : null,
            body: s.created_by ? `${s.created_by.name}: ${s.text}` : s.text,
            is_internal: false,
            external_source: 'asana',
            external_id: s.gid,
          };
        });
    });
    if (noteRows.length > 0) {
      const { data: noteData, error: noteError } = await supabase
        .from('item_notes')
        .upsert(noteRows, { onConflict: 'item_id,external_source,external_id' })
        .select('id');
      if (!noteError) commentsImported = noteData?.length ?? 0;
      // A comment-sync failure shouldn't fail the whole sync — the task
      // data itself already landed successfully above.
    }

    await supabase
      .from('integration_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id);

    return json({ imported, total: tasks.length, commentsImported });
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
