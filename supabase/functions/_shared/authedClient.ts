// Shared helper: build a Supabase client scoped to the calling browser's own
// JWT (forwarded automatically by supabase.functions.invoke), so every DB
// operation an Edge Function performs still goes through RLS as that user —
// no service-role key, no hand-rolled authorization checks.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function authedClient(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
}

export interface CallerProfile {
  id: string;
  workspaceId: string;
  role: string;
}

/** Resolve the caller's profile and require they're a workspace Manager —
 * integration connections hold OAuth tokens, so this is deliberately
 * stricter than the general "any member" bar used elsewhere. */
export async function requireManager(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<CallerProfile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, workspace_id, role')
    .eq('auth_uid', auth.user.id)
    .maybeSingle();
  if (error || !data || data.role !== 'manager') return null;
  return { id: data.id, workspaceId: data.workspace_id, role: data.role };
}
