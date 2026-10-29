// ProductHub — one-way import: pull tasks, comments, owners, and status
// from one Asana project (of possibly several added to this workspace —
// see integration_projects) into the shared backlog. Manual trigger, one
// project per call (the caller passes projectGid) — re-running is safe,
// tasks upsert on (workspace_id, external_source, external_id), comments on
// (item_id, external_source, external_id).
//
// Field mapping: driven entirely by integration_field_mappings, covering
// every source asana-fields discovers — sections, every custom field type,
// and a few built-in task fields. 'board_status'/'priority'/'type' targets
// only make sense for enum-kind sources (a section or an enum custom
// field) and translate through value_map; 'description' works for any
// source and just appends "<label>: <value>" using Asana's display_value
// (formatted for any field type — text/number/date/people/enum alike).
// With no mapping configured, board_status falls back to the completed
// heuristic and priority/type fall back to their column defaults. Because
// Asana is treated as the source of truth for a synced project, an unmapped
// enum field is still written on every sync (not left alone) — a manual
// edit in ProductHub to a synced item's priority/type/status will be
// overwritten by the next sync unless a mapping is configured to preserve it.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requireManager } from '../_shared/authedClient.ts';
import { asanaFetchAllPages, ensureFreshToken, mapConcurrent } from '../_shared/asana.ts';
import { detectModule, detectType } from '../_shared/detect.ts';
import { ARCHIVED_SECTION, COMPLETED_SECTION, namedField, priorityFrom, statusFrom, typeFrom } from '../_shared/asanaMap.ts';

interface AsanaCustomFieldValue {
  gid: string;
  name: string;
  enum_value: { name: string } | null;
  display_value: string | null;
}
interface AsanaTask {
  gid: string;
  name: string;
  notes: string | null;
  completed: boolean;
  created_at: string | null;
  assignee: { gid: string; name: string; email: string | null } | null;
  memberships: { section: { name: string } | null }[];
  custom_fields: AsanaCustomFieldValue[];
  due_on: string | null;
  start_on: string | null;
  tags: { name: string }[];
  permalink_url: string | null;
}
interface AsanaStory {
  gid: string;
  type: string; // 'comment' | 'system'
  text: string;
  created_by: { name: string; email: string } | null;
}
type TargetField =
  | 'board_status' | 'priority' | 'type' | 'description' | 'custom'
  | 'estimated_hours' | 'customer_name' | 'module' | 'tags'
  | 'ignore';
interface FieldMapping {
  source_field: string;
  source_label: string;
  target_field: TargetField;
  value_map: Record<string, string>;
  custom_field_def_id: string | null;
}

function refFor(gid: string): string {
  // Short, stable, and visually distinct from organically-created refs
  // (FEAT-/BUG-/TASK-) without needing a per-workspace sequence counter.
  return `ASN-${gid.slice(-6).toUpperCase()}`;
}

/** The value used for enum-target mapping (board_status/priority/type) —
 * only sections and enum custom fields have a stable label to translate. */
function enumLabel(t: AsanaTask, sourceField: string): string | undefined {
  if (sourceField === '__section__') return t.memberships?.[0]?.section?.name ?? undefined;
  return t.custom_fields.find((c) => c.gid === sourceField)?.enum_value?.name ?? undefined;
}

/** The value used for the "description" target — works for any source. */
function displayValue(t: AsanaTask, sourceField: string): string | undefined {
  switch (sourceField) {
    case '__section__':
      return t.memberships?.[0]?.section?.name ?? undefined;
    case '__due_on__':
      return t.due_on ?? undefined;
    case '__start_on__':
      return t.start_on ?? undefined;
    case '__tags__':
      return t.tags.length > 0 ? t.tags.map((x) => x.name).join(', ') : undefined;
    case '__permalink__':
      return t.permalink_url ?? undefined;
    default:
      return t.custom_fields.find((c) => c.gid === sourceField)?.display_value ?? undefined;
  }
}

interface TeamRow {
  id: string;
  name: string;
  email: string | null;
  profile_id: string | null;
  external_id: string | null;
}
interface ExistingRow {
  external_id: string;
  type: string;
  module: string | null;
  locked_fields: string[] | null;
  archived_at: string | null;
  created_at: string;
}

interface Body {
  projectGid: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = authedClient(req);
  if (!supabase) return json({ error: 'Missing Authorization header.' }, 401);

  const caller = await requireManager(supabase);
  if (!caller) return json({ error: 'Only a workspace Manager can sync integrations.' }, 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  if (!body.projectGid) return json({ error: 'Missing "projectGid".' }, 400);

  const { data: connection, error } = await supabase
    .from('integration_connections')
    .select('id, access_token, refresh_token, expires_at')
    .eq('workspace_id', caller.workspaceId)
    .eq('provider', 'asana')
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!connection) return json({ error: 'Asana is not connected for this workspace.' }, 404);

  const { data: project, error: projectError } = await supabase
    .from('integration_projects')
    .select('id, external_project_gid')
    .eq('connection_id', connection.id)
    .eq('external_project_gid', body.projectGid)
    .maybeSingle();
  if (projectError) return json({ error: projectError.message }, 500);
  if (!project) return json({ error: 'That project is not added to this workspace.' }, 404);

  try {
    const accessToken = await ensureFreshToken(supabase, connection);

    const [tasks, mappingRows, profileRows, moduleRows, memberRows, existingRows] = await Promise.all([
      asanaFetchAllPages<AsanaTask>(
        accessToken,
        `/projects/${project.external_project_gid}/tasks` +
          `?opt_fields=name,notes,completed,created_at,assignee.gid,assignee.name,assignee.email,memberships.section.name,` +
          `custom_fields.gid,custom_fields.name,custom_fields.enum_value.name,custom_fields.display_value,` +
          `due_on,start_on,tags.name,permalink_url&limit=100`,
      ),
      supabase
        .from('integration_field_mappings')
        .select('source_field, source_label, target_field, value_map, custom_field_def_id')
        .eq('workspace_id', caller.workspaceId)
        .eq('provider', 'asana')
        .then((r) => (r.data ?? []) as FieldMapping[]),
      supabase
        .from('profiles')
        .select('id, email')
        .eq('workspace_id', caller.workspaceId)
        .then((r) => (r.data ?? []) as { id: string; email: string }[]),
      supabase
        .from('modules')
        .select('name, aliases')
        .eq('workspace_id', caller.workspaceId)
        .then((r) => (r.data ?? []) as { name: string; aliases: string[] | null }[]),
      supabase
        .from('team_members')
        .select('id, name, email, profile_id, external_id')
        .eq('workspace_id', caller.workspaceId)
        .then((r) => (r.data ?? []) as TeamRow[]),
      supabase
        .from('backlog_items')
        .select('external_id, type, module, locked_fields, archived_at, created_at')
        .eq('workspace_id', caller.workspaceId)
        .eq('external_source', 'asana')
        .then((r) => (r.data ?? []) as ExistingRow[]),
    ]);

    const enumMappings = mappingRows.filter((m) => ['board_status', 'priority', 'type'].includes(m.target_field));
    const descriptionMappings = mappingRows.filter((m) => m.target_field === 'description');
    const customMappings = mappingRows.filter((m) => m.target_field === 'custom' && m.custom_field_def_id);
    const directMappings = (target: TargetField) => mappingRows.filter((m) => m.target_field === target);
    const estimatedHoursMappings = directMappings('estimated_hours');
    const customerNameMappings = directMappings('customer_name');
    const moduleMappings = directMappings('module');
    const tagsMappings = directMappings('tags');
    const profileByEmail = new Map(profileRows.map((p) => [p.email.toLowerCase(), p.id]));

    /** Last mapping targeting this field wins if more than one is
     * configured — mirrors the enum-mapping precedence above. */
    function lastMappedValue(t: AsanaTask, mappings: FieldMapping[]): string | undefined {
      let found: string | undefined;
      for (const m of mappings) {
        const val = displayValue(t, m.source_field);
        if (val) found = val;
      }
      return found;
    }

    // ---- Team: every Asana assignee becomes a roster member -----------------
    // Match an existing member by Asana gid, then email, then exact name (so
    // someone already added by hand or with a login isn't duplicated); create
    // whoever is missing. Their tasks are linked to the member below.
    const memberByGid = new Map<string, TeamRow>();
    const memberByEmail = new Map<string, TeamRow>();
    const memberByName = new Map<string, TeamRow>();
    for (const m of memberRows) {
      if (m.external_id) memberByGid.set(m.external_id, m);
      if (m.email) memberByEmail.set(m.email.toLowerCase(), m);
      memberByName.set(m.name.trim().toLowerCase(), m);
    }
    const assignees = new Map<string, { gid: string; name: string; email: string | null }>();
    for (const t of tasks) if (t.assignee?.gid) assignees.set(t.assignee.gid, t.assignee);
    const linkUpdates: { id: string; external_id: string }[] = [];
    const toCreate: { workspace_id: string; name: string; email: string | null; external_source: string; external_id: string }[] = [];
    for (const a of assignees.values()) {
      if (memberByGid.has(a.gid)) continue;
      const existing =
        (a.email ? memberByEmail.get(a.email.toLowerCase()) : undefined) ?? memberByName.get(a.name.trim().toLowerCase());
      if (existing && !existing.external_id) {
        linkUpdates.push({ id: existing.id, external_id: a.gid });
        memberByGid.set(a.gid, existing);
      } else {
        toCreate.push({
          workspace_id: caller.workspaceId,
          name: a.name || a.email || 'Asana user',
          email: a.email?.toLowerCase() ?? null,
          external_source: 'asana',
          external_id: a.gid,
        });
      }
    }
    for (const u of linkUpdates) {
      await supabase.from('team_members').update({ external_source: 'asana', external_id: u.external_id }).eq('id', u.id);
    }
    let membersCreated = 0;
    if (toCreate.length > 0) {
      const { data: created, error: createError } = await supabase
        .from('team_members')
        .upsert(toCreate, { onConflict: 'workspace_id,external_source,external_id' })
        .select('id, name, email, profile_id, external_id');
      if (createError) return json({ error: `Could not create team members: ${createError.message}` }, 500);
      membersCreated = created?.length ?? 0;
      for (const m of (created ?? []) as TeamRow[]) if (m.external_id) memberByGid.set(m.external_id, m);
    }

    const existingByGid = new Map(existingRows.map((r) => [r.external_id, r]));
    const moduleCatalog = moduleRows.map((m) => ({ name: m.name, aliases: m.aliases ?? [] }));
    const knownModules = new Set(moduleRows.map((m) => m.name.toLowerCase()));
    const newModules = new Set<string>();

    const rows = tasks.map((t) => {
      const existing = existingByGid.get(t.gid);
      const locked = new Set(existing?.locked_fields ?? []);
      let board_status: string | undefined;
      let priority: string | undefined;
      let type: string | undefined;
      for (const m of enumMappings) {
        const label = enumLabel(t, m.source_field);
        if (!label) continue;
        const mapped = m.value_map[label];
        if (!mapped) continue;
        if (m.target_field === 'board_status') board_status = mapped;
        else if (m.target_field === 'priority') priority = mapped;
        else if (m.target_field === 'type') type = mapped;
      }
      // No mapping matched (or none configured) — fall back to the only
      // universal signal Asana gives every task for free.
      // Same-name auto-mapping (see FIELD_NAMES): the Asana section / a
      // "Status" field, a "Priority" field, a "Type" field.
      const section = t.memberships?.[0]?.section?.name;
      const inArchivedSection = !!section && ARCHIVED_SECTION.test(section.trim());
      // A task sitting in a "Completed"/"Done" column is completed here, whatever the mappings say.
      if (section && COMPLETED_SECTION.test(section.trim())) board_status = 'released';
      if (!board_status && t.completed) board_status = 'released';
      if (!board_status) {
        board_status = statusFrom(namedField(t.custom_fields, 'status')?.enum_value?.name) ?? (inArchivedSection ? undefined : statusFrom(section));
      }
      if (!board_status) board_status = 'triaged';
      if (!priority) priority = priorityFrom(namedField(t.custom_fields, 'priority')?.enum_value?.name ?? namedField(t.custom_fields, 'priority')?.display_value ?? undefined);
      if (!type) type = typeFrom(namedField(t.custom_fields, 'type')?.enum_value?.name ?? namedField(t.custom_fields, 'type')?.display_value ?? undefined);
      // No field gave a type — read it from the title/body; a hand-edited type is kept.
      if (locked.has('type') && existing) type = existing.type;
      else if (!type) type = detectType(t.name, t.notes ?? '') ?? undefined;

      const extras = descriptionMappings
        .map((m) => {
          const val = displayValue(t, m.source_field);
          return val ? `${m.source_label}: ${val}` : null;
        })
        .filter((x): x is string => x !== null);
      const description = [t.notes || '', ...extras].filter(Boolean).join('\n\n');

      // Fields the Manager chose to create as real custom fields (rather
      // than just appended to the description) — keyed by definition id so
      // the frontend can resolve names without denormalizing them here.
      const custom_fields: Record<string, string> = {};
      for (const m of customMappings) {
        const val = displayValue(t, m.source_field);
        if (val) custom_fields[m.custom_field_def_id as string] = val;
      }

      const member = t.assignee?.gid ? memberByGid.get(t.assignee.gid) : undefined;
      const assignee_member_id = member?.id ?? null;
      const assignee_id = member?.profile_id ?? null;
      // Only a fallback label now — members are created for every assignee.
      const external_assignee_name = !member && t.assignee ? t.assignee.name : null;

      const estimatedRaw = lastMappedValue(t, estimatedHoursMappings) ?? namedField(t.custom_fields, 'estimated')?.display_value ?? undefined;
      const estimatedNum = estimatedRaw ? Number(estimatedRaw.replace(/[^0-9.]/g, '')) : NaN;
      const estimated_hours = Number.isFinite(estimatedNum) ? estimatedNum : null;
      const customer_name = lastMappedValue(t, customerNameMappings) ?? namedField(t.custom_fields, 'customer')?.display_value ?? null;
      let module: string | null =
        lastMappedValue(t, moduleMappings) ??
        namedField(t.custom_fields, 'module')?.enum_value?.name ??
        namedField(t.custom_fields, 'module')?.display_value ??
        detectModule(t.name, t.notes ?? '', moduleCatalog);
      if (locked.has('module') && existing) module = existing.module;
      if (module && !knownModules.has(module.toLowerCase())) newModules.add(module);
      // Asana's own tags carry over when no mapping says otherwise.
      const tagsRaw = lastMappedValue(t, tagsMappings);
      const tags = tagsRaw
        ? tagsRaw.split(',').map((x) => x.trim()).filter(Boolean)
        : (t.tags ?? []).map((x) => x.name);

      return {
        workspace_id: caller.workspaceId,
        ref: refFor(t.gid),
        title: t.name || '(untitled Asana task)',
        description,
        type: type ?? 'feature',
        board_status,
        estimated_hours,
        customer_name,
        module,
        tags,
        priority: priority ?? 'medium',
        assignee_id,
        assignee_member_id,
        external_assignee_name,
        // The real Asana creation date — not the moment it was imported here.
        created_at: t.created_at ?? existing?.created_at ?? new Date().toISOString(),
        // Marks this write as a pull so the dirty-tracking trigger doesn't count it as a local edit.
        last_pulled_at: new Date().toISOString(),
        dirty_since: null,
        archived_at: inArchivedSection ? (existing?.archived_at ?? new Date().toISOString()) : null,
        custom_fields,
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

    // Modules seen on these tasks (mapped from Asana or detected) join the catalog.
    if (newModules.size > 0) {
      await supabase
        .from('modules')
        .upsert([...newModules].map((name) => ({ workspace_id: caller.workspaceId, name })), {
          onConflict: 'workspace_id,name',
          ignoreDuplicates: true,
        });
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
      .from('integration_projects')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', project.id);

    return json({ imported, total: tasks.length, commentsImported, membersCreated });
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
