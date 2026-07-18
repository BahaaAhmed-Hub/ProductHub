// ProductHub — discover the connected Asana project's mappable fields:
// its board sections (always available, used for status) and whatever
// custom fields the project actually has (never hardcoded — a project
// picked up a new custom field in Asana shows up here with no code change).
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requireManager } from '../_shared/authedClient.ts';
import { asanaFetch, ensureFreshToken } from '../_shared/asana.ts';

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
    resource_subtype: string; // 'enum' | 'multi_enum' | 'text' | 'number' | ...
    enum_options?: AsanaEnumOption[];
  };
}

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

    const sectionField = {
      sourceField: '__section__',
      label: 'Section (board column)',
      options: sections.map((s) => s.name),
    };
    const customFields = fieldSettings
      .filter((f) => ['enum', 'multi_enum'].includes(f.custom_field.resource_subtype))
      .map((f) => ({
        sourceField: f.custom_field.gid,
        label: f.custom_field.name,
        options: (f.custom_field.enum_options ?? []).map((o) => o.name),
      }));

    return json({ fields: [sectionField, ...customFields] });
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
