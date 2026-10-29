// ProductHub — write-back to Asana for backlog actions: complete / reopen a
// task, archive / unarchive it, or delete it. "Archive" has no Asana equivalent, so it
// moves the task into an "Archived" section of its project (created if the
// project doesn't have one); unarchive moves it back to the project's first
// other section. The browser applies the matching local change itself for
// every item this returns ok/skipped for.
//
// The Asana token is manager-only under RLS, so for a PM the connection read
// comes back empty and every item is reported 'skipped' (local change only).
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient } from '../_shared/authedClient.ts';
import { asanaFetch, asanaWrite, ensureFreshToken, mapConcurrent } from '../_shared/asana.ts';
import { COMPLETED_SECTION } from '../_shared/asanaMap.ts';

type Action = 'complete' | 'reopen' | 'archive' | 'unarchive' | 'delete';
interface Body {
  action: Action;
  itemIds: string[];
}
interface Result {
  id: string;
  status: 'ok' | 'skipped' | 'error';
  error?: string;
}
interface Section {
  gid: string;
  name: string;
}

const ARCHIVED = /^archived?$/i;

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
  if (!['complete', 'reopen', 'archive', 'unarchive', 'delete'].includes(body.action) || !Array.isArray(body.itemIds)) {
    return json({ error: 'Expected { action, itemIds }.' }, 400);
  }

  // RLS scopes this to the caller's workspace.
  const { data: items, error } = await supabase
    .from('backlog_items')
    .select('id, external_source, external_id')
    .in('id', body.itemIds);
  if (error) return json({ error: error.message }, 500);

  const results: Result[] = [];
  const asanaItems = (items ?? []).filter(
    (i: { external_source: string | null; external_id: string | null }) => i.external_source === 'asana' && i.external_id,
  ) as { id: string; external_id: string }[];
  const asanaIds = new Set(asanaItems.map((i) => i.id));
  for (const id of body.itemIds) if (!asanaIds.has(id)) results.push({ id, status: 'skipped' });

  if (asanaItems.length > 0) {
    // Manager-only under RLS — null for a PM.
    const { data: connection } = await supabase
      .from('integration_connections')
      .select('id, access_token, refresh_token, expires_at')
      .eq('provider', 'asana')
      .maybeSingle();
    if (!connection) {
      for (const i of asanaItems) results.push({ id: i.id, status: 'skipped' });
      return json({ results, note: 'Asana was not updated: only a Manager with a connected Asana account can write to it.' });
    }

    try {
      const token = await ensureFreshToken(supabase, connection);
      const sectionCache = new Map<string, Section[]>();
      const sectionsOf = async (projectGid: string): Promise<Section[]> => {
        const hit = sectionCache.get(projectGid);
        if (hit) return hit;
        const list = (await asanaFetch(token, `/projects/${projectGid}/sections?opt_fields=name`)) as Section[];
        sectionCache.set(projectGid, list);
        return list;
      };

      const done = await mapConcurrent(asanaItems, 3, async (item): Promise<Result> => {
        try {
          if (body.action === 'delete') {
            await asanaWrite(token, 'DELETE', `/tasks/${item.external_id}`);
            return { id: item.id, status: 'ok' };
          }
          if (body.action === 'complete' || body.action === 'reopen') {
            await asanaWrite(token, 'PUT', `/tasks/${item.external_id}`, { completed: body.action === 'complete' });
            // Also move it between the project's "Completed" column and the rest, where the
            // project has one. Best-effort: the task itself is already marked done/reopened.
            try {
              const task = (await asanaFetch(
                token,
                `/tasks/${item.external_id}?opt_fields=memberships.project.gid,memberships.section.gid,memberships.section.name`,
              )) as { memberships: { project: { gid: string } | null; section: { gid: string; name: string } | null }[] };
              for (const m of task.memberships) {
                if (!m.project) continue;
                const sections = await sectionsOf(m.project.gid);
                const inDone = !!m.section && COMPLETED_SECTION.test(m.section.name.trim());
                let target: Section | undefined;
                if (body.action === 'complete' && !inDone) target = sections.find((s) => COMPLETED_SECTION.test(s.name.trim()));
                if (body.action === 'reopen' && inDone) {
                  target = sections.find((s) => !COMPLETED_SECTION.test(s.name.trim()) && !ARCHIVED.test(s.name.trim()));
                }
                if (target) await asanaWrite(token, 'POST', `/sections/${target.gid}/addTask`, { task: item.external_id });
              }
            } catch (_) {
              // ignore — see above
            }
            return { id: item.id, status: 'ok' };
          }
          const task = (await asanaFetch(
            token,
            `/tasks/${item.external_id}?opt_fields=memberships.project.gid`,
          )) as { memberships: { project: { gid: string } | null }[] };
          const projectGids = [...new Set(task.memberships.map((m) => m.project?.gid).filter((g): g is string => !!g))];
          for (const pg of projectGids) {
            const sections = await sectionsOf(pg);
            let target: Section | undefined;
            if (body.action === 'archive') {
              target = sections.find((s) => ARCHIVED.test(s.name.trim()));
              if (!target) {
                target = (await asanaWrite(token, 'POST', `/projects/${pg}/sections`, { name: 'Archived' })) as Section;
                sections.push(target);
              }
            } else {
              target = sections.find((s) => !ARCHIVED.test(s.name.trim()));
            }
            if (target) await asanaWrite(token, 'POST', `/sections/${target.gid}/addTask`, { task: item.external_id });
          }
          return { id: item.id, status: 'ok' };
        } catch (e) {
          return { id: item.id, status: 'error', error: String(e instanceof Error ? e.message : e) };
        }
      });
      results.push(...done);
    } catch (e) {
      return json({ error: String(e instanceof Error ? e.message : e) }, 502);
    }
  }

  return json({ results });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
