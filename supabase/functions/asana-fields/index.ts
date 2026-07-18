// ProductHub — discover every mappable field on the connected Asana
// project: its board sections, every custom field regardless of type
// (text/number/date/people/enum/multi_enum — per Asana's task resource:
// https://developers.asana.com/reference/tasks), and a handful of built-in
// task fields that don't otherwise have a home in ProductHub's schema.
// Never hardcoded to a fixed field list — a project's actual custom fields
// are fetched live, so a new one shows up here with no code change.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requireManager } from '../_shared/authedClient.ts';
import { asanaFetch, ensureFreshToken } from '../_shared/asana.ts';

// 'enum' is the only kind whose values are known in advance (enum_options)
// and can be translated 1:1 into a ProductHub enum column. Every other kind
// only has "description" (append the value) or "ignore" as a sensible
// mapping target — see FieldMapping.targetField in the frontend.
export type FieldKind = 'enum' | 'other';

interface AsanaSection {
  gid: string;
  name: string;
}
interface AsanaEnumOption {
  gid: string;
  name: string;
}
interface AsanaCustomFieldSetting {
  custom_field: {
    gid: string;
    name: string;
    resource_subtype: string; // 'enum' | 'multi_enum' | 'text' | 'number' | 'date' | 'people' | 'formula' | ...
    enum_options?: AsanaEnumOption[];
  };
}

interface Field {
  sourceField: string;
  label: string;
  kind: FieldKind;
  options: string[];
}

// Built-in task fields with no dedicated ProductHub column — mappable only
// to "description". Kept short and high-value rather than exhaustively
// covering every field on the task resource (dependencies, followers,
// hearts/likes, subtasks): those don't translate into anything ProductHub
// tracks even as free text, so they're deliberately left out.
const BUILTIN_FIELDS: Field[] = [
  { sourceField: '__due_on__', label: 'Due date', kind: 'other', options: [] },
  { sourceField: '__start_on__', label: 'Start date', kind: 'other', options: [] },
  { sourceField: '__tags__', label: 'Tags', kind: 'other', options: [] },
  { sourceField: '__permalink__', label: 'Asana link', kind: 'other', options: [] },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = authedClient(req);
  if (!supabase) return json({ error: 'Missing Authorization header.' }, 401);

  const caller = await requireManager(supabase);
  if (!caller) return json({ error: 'Only a workspace Manager can view integration settings.' }, 403);

  const { data: connection, error } = await supabase
    .from('integration_connections')
    .select('id, access_token, refresh_token, expires_at, external_project_gid')
    .eq('workspace_id', caller.workspaceId)
    .eq('provider', 'asana')
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!connection) return json({ error: 'Asana is not connected for this workspace.' }, 404);
  if (!connection.external_project_gid) return json({ error: 'Pick an Asana project first.' }, 400);

  try {
    const accessToken = await ensureFreshToken(supabase, connection);
    const [sections, fieldSettings] = await Promise.all([
      asanaFetch(accessToken, `/projects/${connection.external_project_gid}/sections`) as Promise<AsanaSection[]>,
      asanaFetch(
        accessToken,
        `/projects/${connection.external_project_gid}/custom_field_settings?opt_fields=custom_field.name,custom_field.resource_subtype,custom_field.enum_options.name`,
      ) as Promise<AsanaCustomFieldSetting[]>,
    ]);

    const sectionField: Field = {
      sourceField: '__section__',
      label: 'Section (board column)',
      kind: 'enum',
      options: sections.map((s) => s.name),
    };

    // Every custom field the project has, of any type — not filtered down
    // to enum/multi_enum. A text/number/date/people/multi_enum field just
    // comes through with kind 'other' and no options; the frontend only
    // offers it "description" or "ignore" as a target.
    const customFields: Field[] = fieldSettings.map((f) => ({
      sourceField: f.custom_field.gid,
      label: f.custom_field.name,
      kind: f.custom_field.resource_subtype === 'enum' ? 'enum' : 'other',
      options: f.custom_field.resource_subtype === 'enum' ? (f.custom_field.enum_options ?? []).map((o) => o.name) : [],
    }));

    return json({ fields: [sectionField, ...customFields, ...BUILTIN_FIELDS] });
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
