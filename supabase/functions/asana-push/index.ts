// ProductHub — push local edits on synced tasks back to Asana, then re-read
// each task from Asana to validate the write, and log the outcome.
//
// Pushed: title, completed (status "released"), assignee, and — wherever the
// task's Asana project has a matching field — priority, type, module,
// customer and estimated hours. A field is "matching" when an explicit
// integration_field_mappings row points at it, else when its NAME is the
// ProductHub field's name (Priority, Type, Module, ...; see _shared/asanaMap).
// Board status moves the task between sections when the project has a
// Status field or a section that corresponds. Anything with no counterpart
// in Asana is reported as skipped in the log, never silently dropped.
//
// moduleRename {from,to}: before pushing, renames the Asana enum option
// "from" to "to" (once), so every task keeps pointing at the same option.
//
// The Asana token is manager-only under RLS, so for a PM the connection read
// is empty and each item is logged as skipped.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient } from '../_shared/authedClient.ts';
import { asanaFetch, asanaWrite, ensureFreshToken, mapConcurrent } from '../_shared/asana.ts';
import { ARCHIVED_SECTION, namedField, priorityFrom, statusFrom, typeFrom } from '../_shared/asanaMap.ts';

interface Body {
  itemIds: string[];
  moduleRename?: { from: string; to: string };
}
interface Item {
  id: string;
  ref: string;
  title: string;
  type: string;
  priority: string;
  board_status: string;
  module: string | null;
  customer_name: string | null;
  estimated_hours: number | null;
  assignee_member_id: string | null;
  external_assignee_name: string | null;
  external_id: string;
  archived_at: string | null;
}
interface Option {
  gid: string;
  name: string;
}
interface CustomField {
  gid: string;
  name: string;
  resource_subtype: string;
  enum_options?: Option[];
  enum_value: Option | null;
  display_value: string | null;
  number_value?: number | null;
  text_value?: string | null;
}
interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  assignee: { gid: string; email: string | null } | null;
  custom_fields: CustomField[];
  memberships: { project: { gid: string } | null; section: { gid: string; name: string } | null }[];
}
interface Mapping {
  source_field: string;
  target_field: string;
  value_map: Record<string, string>;
}
interface FieldReport {
  sent: unknown;
  actual: unknown;
  ok: boolean;
}

const TASK_FIELDS =
  'name,completed,assignee.gid,assignee.email,' +
  'custom_fields.gid,custom_fields.name,custom_fields.resource_subtype,custom_fields.enum_options.name,' +
  'custom_fields.enum_value.name,custom_fields.display_value,custom_fields.number_value,custom_fields.text_value,' +
  'memberships.project.gid,memberships.section.gid,memberships.section.name';

const eq = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = authedClient(req);
  if (!supabase) return json({ error: 'Missing Authorization header.' }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  if (!Array.isArray(body.itemIds) || body.itemIds.length === 0) return json({ error: 'Expected { itemIds }.' }, 400);
  const itemIds = body.itemIds.slice(0, 200);

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return json({ error: 'Not signed in.' }, 401);
  const { data: me } = await supabase.from('profiles').select('id, workspace_id, role').eq('auth_uid', auth.user.id).maybeSingle();
  if (!me || !['pm', 'manager'].includes(me.role)) return json({ error: 'Only a PM or Manager can sync to Asana.' }, 403);

  const { data: itemRows, error } = await supabase
    .from('backlog_items')
    .select(
      'id, ref, title, type, priority, board_status, module, customer_name, estimated_hours, assignee_member_id, external_assignee_name, external_id, archived_at',
    )
    .in('id', itemIds)
    .eq('external_source', 'asana');
  if (error) return json({ error: error.message }, 500);
  const items = (itemRows ?? []) as Item[];

  const action = body.moduleRename ? 'module_rename' : 'push';
  const results: { id: string; status: string; detail: string }[] = [];
  const logRows: Record<string, unknown>[] = [];
  const record = (item: Item, status: string, detail: string, fields: Record<string, FieldReport> = {}) => {
    results.push({ id: item.id, status, detail });
    logRows.push({
      workspace_id: me.workspace_id, item_id: item.id, item_ref: item.ref, action, status, detail, fields, created_by: me.id,
    });
  };

  // Manager-only under RLS — null for a PM.
  const { data: connection } = await supabase
    .from('integration_connections')
    .select('id, access_token, refresh_token, expires_at')
    .eq('provider', 'asana')
    .maybeSingle();

  if (!connection) {
    for (const i of items) record(i, 'skipped', "Not pushed: only a Manager's connected Asana account can write to Asana.");
    await supabase.from('integration_sync_log').insert(logRows);
    return json({ results });
  }

  try {
    const token = await ensureFreshToken(supabase, connection);

    const [mappings, members] = await Promise.all([
      supabase
        .from('integration_field_mappings')
        .select('source_field, target_field, value_map')
        .eq('provider', 'asana')
        .then((r) => (r.data ?? []) as Mapping[]),
      supabase
        .from('team_members')
        .select('id, external_id, email')
        .in('id', items.map((i) => i.assignee_member_id).filter((x): x is string => !!x))
        .then((r) => (r.data ?? []) as { id: string; external_id: string | null; email: string | null }[]),
    ]);
    const memberById = new Map(members.map((m) => [m.id, m]));
    const sectionCache = new Map<string, { gid: string; name: string }[]>();
    const sectionsOf = async (pg: string) => {
      const hit = sectionCache.get(pg);
      if (hit) return hit;
      const list = (await asanaFetch(token, `/projects/${pg}/sections?opt_fields=name`)) as { gid: string; name: string }[];
      sectionCache.set(pg, list);
      return list;
    };

    /** The task's custom field for one ProductHub field: explicit mapping first, then same-name. */
    const fieldFor = (task: AsanaTask, target: string, nameKey: Parameters<typeof namedField>[1]) => {
      const mapped = mappings.find((m) => m.target_field === target && m.source_field !== '__section__');
      const byMap = mapped ? task.custom_fields.find((c) => c.gid === mapped.source_field) : undefined;
      return { field: byMap ?? namedField(task.custom_fields, nameKey), mapping: mapped };
    };

    const pushOne = async (item: Item): Promise<void> => {
      try {
        const task = (await asanaFetch(token, `/tasks/${item.external_id}?opt_fields=${TASK_FIELDS}`)) as AsanaTask;
        const update: Record<string, unknown> = {};
        const customUpdate: Record<string, unknown> = {};
        const expect: Record<string, { sent: unknown; read: (t: AsanaTask) => unknown; same: (a: unknown, b: unknown) => boolean }> = {};
        const notes: string[] = [];
        const same = (a: unknown, b: unknown) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

        if (task.name !== item.title) {
          update.name = item.title;
          expect.name = { sent: item.title, read: (t) => t.name, same };
        }
        const wantDone = item.board_status === 'released';
        if (task.completed !== wantDone) {
          update.completed = wantDone;
          expect.completed = { sent: wantDone, read: (t) => t.completed, same };
        }

        // Assignee: team member's Asana gid, else their email; unassigned clears it.
        const member = item.assignee_member_id ? memberById.get(item.assignee_member_id) : undefined;
        if (member) {
          const ref = member.external_id ?? member.email;
          if (!ref) notes.push('assignee: member has no Asana id or email');
          else if (task.assignee?.gid !== member.external_id && !eq(task.assignee?.email, member.email)) {
            update.assignee = ref;
            expect.assignee = {
              sent: ref,
              read: (t) => (member.external_id ? t.assignee?.gid : t.assignee?.email),
              same,
            };
          }
        } else if (!item.assignee_member_id && !item.external_assignee_name && task.assignee) {
          update.assignee = null;
          expect.assignee = { sent: null, read: (t) => t.assignee?.gid ?? null, same };
        }

        // Enum-valued fields: pick the option by explicit value_map, else by keyword/name.
        const enumValue = (
          f: CustomField,
          mapping: Mapping | undefined,
          value: string,
          fromName: (n: string) => string | undefined,
        ): Option | undefined => {
          const opts = f.enum_options ?? [];
          const label = mapping ? Object.entries(mapping.value_map).find(([, v]) => v === value)?.[0] : undefined;
          return (label ? opts.find((o) => eq(o.name, label)) : undefined) ?? opts.find((o) => fromName(o.name) === value);
        };
        const setEnum = (key: string, f: CustomField, opt: Option | undefined, label: string) => {
          if (!opt) return notes.push(`${key}: no "${label}" option in Asana field "${f.name}"`);
          if (f.enum_value?.gid === opt.gid || eq(f.enum_value?.name, opt.name)) return;
          customUpdate[f.gid] = opt.gid;
          expect[key] = { sent: opt.name, read: (t) => t.custom_fields.find((c) => c.gid === f.gid)?.enum_value?.name, same };
        };
        const setText = (key: string, f: CustomField, value: string | number | null) => {
          const current = f.resource_subtype === 'number' ? f.number_value : f.text_value ?? f.display_value;
          if (String(current ?? '') === String(value ?? '')) return;
          customUpdate[f.gid] = value;
          expect[key] = {
            sent: value,
            read: (t) => {
              const c = t.custom_fields.find((x) => x.gid === f.gid);
              return f.resource_subtype === 'number' ? c?.number_value : c?.text_value ?? c?.display_value;
            },
            same: (a, b) => (f.resource_subtype === 'number' ? Number(a) === Number(b) : same(a, b)),
          };
        };
        const noField = (key: string) => notes.push(`${key}: no matching field in this Asana project`);

        const pr = fieldFor(task, 'priority', 'priority');
        if (!pr.field) noField('priority');
        else if (pr.field.resource_subtype === 'enum') {
          setEnum('priority', pr.field, enumValue(pr.field, pr.mapping, item.priority, (n) => priorityFrom(n)), item.priority);
        }

        const ty = fieldFor(task, 'type', 'type');
        if (!ty.field) noField('type');
        else if (ty.field.resource_subtype === 'enum') {
          setEnum('type', ty.field, enumValue(ty.field, ty.mapping, item.type, (n) => typeFrom(n)), item.type);
        }

        const mo = fieldFor(task, 'module', 'module');
        if (!mo.field) noField('module');
        else if (mo.field.resource_subtype === 'enum') {
          const f = mo.field;
          if (!item.module) {
            if (f.enum_value) {
              customUpdate[f.gid] = null;
              expect.module = { sent: null, read: (t) => t.custom_fields.find((c) => c.gid === f.gid)?.enum_value?.name ?? null, same };
            }
          } else {
            let opt = (f.enum_options ?? []).find((o) => eq(o.name, item.module));
            // Rename: the old option becomes the new name instead of leaving a stale duplicate.
            if (!opt && body.moduleRename) {
              const old = (f.enum_options ?? []).find((o) => eq(o.name, body.moduleRename?.from));
              if (old) {
                await asanaWrite(token, 'PUT', `/enum_options/${old.gid}`, { name: body.moduleRename.to });
                old.name = body.moduleRename.to;
                opt = old;
              }
            }
            setEnum('module', f, opt, item.module);
          }
        } else {
          setText('module', mo.field, item.module);
        }

        const cu = fieldFor(task, 'customer_name', 'customer');
        if (cu.field && item.customer_name) {
          if (cu.field.resource_subtype === 'enum') {
            setEnum('customer', cu.field, (cu.field.enum_options ?? []).find((o) => eq(o.name, item.customer_name)), item.customer_name);
          } else setText('customer', cu.field, item.customer_name);
        }

        const es = fieldFor(task, 'estimated_hours', 'estimated');
        if (es.field && item.estimated_hours != null && es.field.resource_subtype !== 'enum') {
          setText('estimated hours', es.field, es.field.resource_subtype === 'number' ? item.estimated_hours : String(item.estimated_hours));
        }

        // Board status → project section (unless archived — asana-action owns that).
        let sectionTarget: { gid: string; name: string } | undefined;
        const projectGid = task.memberships.find((m) => m.project)?.project?.gid;
        const currentSection = task.memberships.find((m) => m.project)?.section;
        if (!item.archived_at && projectGid) {
          const sections = await sectionsOf(projectGid);
          const sectionMap = mappings.find((m) => m.source_field === '__section__' && m.target_field === 'board_status');
          const label = sectionMap ? Object.entries(sectionMap.value_map).find(([, v]) => v === item.board_status)?.[0] : undefined;
          const currentStatus = currentSection
            ? sectionMap?.value_map[currentSection.name] ?? statusFrom(currentSection.name)
            : undefined;
          if (currentStatus !== item.board_status && !(currentSection && ARCHIVED_SECTION.test(currentSection.name.trim()))) {
            sectionTarget =
              (label ? sections.find((s) => eq(s.name, label)) : undefined) ??
              sections.find((s) => !ARCHIVED_SECTION.test(s.name.trim()) && statusFrom(s.name) === item.board_status);
            if (!sectionTarget && currentSection) notes.push(`status: no section for "${item.board_status}" in this project`);
          }
        }

        if (Object.keys(customUpdate).length > 0) update.custom_fields = customUpdate;
        const hasWork = Object.keys(update).length > 0 || sectionTarget;
        if (!hasWork) {
          if (notes.length > 0) record(item, 'ok', `Nothing to change. ${notes.join('; ')}`);
          else record(item, 'ok', 'Already in sync with Asana.');
          await supabase.from('backlog_items').update({ dirty_since: null }).eq('id', item.id);
          return;
        }

        if (Object.keys(update).length > 0) await asanaWrite(token, 'PUT', `/tasks/${item.external_id}`, update);
        if (sectionTarget) {
          await asanaWrite(token, 'POST', `/sections/${sectionTarget.gid}/addTask`, { task: item.external_id });
          expect.status = {
            sent: sectionTarget.name,
            read: (t) => t.memberships.find((m) => m.project)?.section?.name,
            same,
          };
        }

        // Validate: read the task back and compare every field we wrote.
        const after = (await asanaFetch(token, `/tasks/${item.external_id}?opt_fields=${TASK_FIELDS}`)) as AsanaTask;
        const fields: Record<string, FieldReport> = {};
        for (const [key, e] of Object.entries(expect)) {
          const actual = e.read(after);
          fields[key] = { sent: e.sent, actual: actual ?? null, ok: e.same(e.sent, actual) };
        }
        const bad = Object.entries(fields).filter(([, f]) => !f.ok).map(([k]) => k);
        const wrote = Object.keys(fields).join(', ');
        if (bad.length === 0) {
          record(item, 'ok', `Pushed and verified in Asana: ${wrote}.${notes.length ? ' Skipped — ' + notes.join('; ') : ''}`, fields);
          await supabase.from('backlog_items').update({ dirty_since: null }).eq('id', item.id);
        } else {
          record(item, 'partial', `Asana did not confirm: ${bad.join(', ')}.${notes.length ? ' Skipped — ' + notes.join('; ') : ''}`, fields);
        }
      } catch (e) {
        record(item, 'error', String(e instanceof Error ? e.message : e));
      }
    };

    // A rename touches shared enum options — one task at a time so the first
    // renames the option and the rest just find it under its new name.
    await mapConcurrent(items, body.moduleRename ? 1 : 3, pushOne);
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502);
  }

  if (logRows.length > 0) await supabase.from('integration_sync_log').insert(logRows);
  return json({ results });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
