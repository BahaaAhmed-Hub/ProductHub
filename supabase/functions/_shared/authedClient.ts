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

export interface CallerPlatformAdmin {
  id: string;
  name: string;
  role: string;
}

/** Platform Admin console callers (ProductHub-Admin, a separate app/repo
 * sharing this Supabase project) are gated by platform_admins, not
 * profiles/role — a completely different trust boundary from every other
 * Edge Function here. */
async function resolvePlatformAdmin(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<CallerPlatformAdmin | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const { data, error } = await supabase
    .from('platform_admins')
    .select('id, name, role, status')
    .eq('auth_uid', auth.user.id)
    .maybeSingle();
  if (error || !data || data.status !== 'active') return null;
  return { id: data.id, name: data.name, role: data.role };
}

export async function requirePlatformAdmin(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<CallerPlatformAdmin | null> {
  return resolvePlatformAdmin(supabase);
}

export async function requirePlatformOwner(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<CallerPlatformAdmin | null> {
  const admin = await resolvePlatformAdmin(supabase);
  return admin?.role === 'Platform Owner' ? admin : null;
}

export interface CallerOrg {
  id: string;
  name: string;
  plan: string;
  stripeCustomerId: string | null;
}

/** The Manager's org — billing lives at the org level (one subscription
 * covers every workspace under it), not the workspace level. */
export async function getOrgForWorkspace(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  workspaceId: string,
): Promise<CallerOrg | null> {
  const { data: ws, error: wsError } = await supabase.from('workspaces').select('org_id').eq('id', workspaceId).maybeSingle();
  if (wsError || !ws) return null;
  const { data: org, error: orgError } = await supabase
    .from('orgs')
    .select('id, name, plan, stripe_customer_id')
    .eq('id', ws.org_id)
    .maybeSingle();
  if (orgError || !org) return null;
  return { id: org.id, name: org.name, plan: org.plan, stripeCustomerId: org.stripe_customer_id };
}
