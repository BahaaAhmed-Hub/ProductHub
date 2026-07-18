import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface AsanaConnection {
  connected: boolean;
  externalWorkspaceName: string | null;
  externalProjectGid: string | null;
  externalProjectName: string | null;
  lastSyncedAt: string | null;
}

export interface AsanaProjectGroup {
  gid: string;
  name: string;
  projects: { gid: string; name: string }[];
}

const NOT_CONNECTED: AsanaConnection = {
  connected: false,
  externalWorkspaceName: null,
  externalProjectGid: null,
  externalProjectName: null,
  lastSyncedAt: null,
};

const REDIRECT_URI = () => window.location.href.split('#')[0];
const EXPECTED_STATE_KEY = 'ph.asanaOAuthExpectedState';
const RETURNED_CODE_KEY = 'ph.asanaOAuthCode';
const RETURNED_STATE_KEY = 'ph.asanaOAuthState';

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // On a non-2xx response, supabase-js discards the function's own JSON
    // body and replaces error.message with a generic "non-2xx status code"
    // string — the real { error: "..." } payload is only reachable via
    // error.context (the raw Response). Without this, every server-side
    // error message (missing secrets, permission checks, Asana API errors)
    // gets flattened into that one useless string.
    if (error instanceof FunctionsHttpError) {
      const bodyMessage = await error.context
        .clone()
        .json()
        .then((b: { error?: string }) => b?.error)
        .catch(() => undefined);
      if (bodyMessage) throw new Error(bodyMessage);
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function useAsanaConnection(): { connection: AsanaConnection; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['integration', 'asana'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<AsanaConnection> => {
      const { data, error } = await supabase
        .from('integration_connections')
        .select('external_workspace_name, external_project_gid, external_project_name, last_synced_at')
        .eq('provider', 'asana')
        .maybeSingle();
      if (error) throw error;
      if (!data) return NOT_CONNECTED;
      return {
        connected: true,
        externalWorkspaceName: data.external_workspace_name,
        externalProjectGid: data.external_project_gid,
        externalProjectName: data.external_project_name,
        lastSyncedAt: data.last_synced_at,
      };
    },
  });
  if (!isSupabaseConfigured) return { connection: NOT_CONNECTED, isLoading: false };
  return { connection: q.data ?? NOT_CONNECTED, isLoading: q.isLoading };
}

/** Kicks off the Asana OAuth redirect. Resolves only once the browser is
 * about to navigate away — there's nothing to await past that. */
export async function connectAsana(): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Connecting Asana requires a configured Supabase project (mock mode has no backend to OAuth against).');
  }
  const redirectUri = REDIRECT_URI();
  const { url, state } = await invoke<{ url: string; state: string }>('asana-oauth', {
    action: 'authorize',
    redirectUri,
  });
  sessionStorage.setItem(EXPECTED_STATE_KEY, state);
  window.location.href = url;
}

/** Called once, from a component mounted for every internal role, so the
 * OAuth return is handled no matter which route the redirect actually lands
 * on (the redirect URI is the app's bare origin — no hash/route survives
 * it). Returns true if a callback was found and processed. */
export async function consumePendingAsanaOAuth(): Promise<boolean> {
  const code = sessionStorage.getItem(RETURNED_CODE_KEY);
  const state = sessionStorage.getItem(RETURNED_STATE_KEY);
  const expected = sessionStorage.getItem(EXPECTED_STATE_KEY);
  sessionStorage.removeItem(RETURNED_CODE_KEY);
  sessionStorage.removeItem(RETURNED_STATE_KEY);
  sessionStorage.removeItem(EXPECTED_STATE_KEY);
  if (!code || !state) return false;
  if (state !== expected) throw new Error('Asana sign-in could not be verified (state mismatch) — please try again.');
  await invoke('asana-oauth', { action: 'callback', code, redirectUri: REDIRECT_URI() });
  return true;
}

export function useAsanaProjects() {
  const q = useQuery({
    queryKey: ['integration', 'asana', 'projects'],
    enabled: false, // fetched on demand — see refetch() in the picker UI
    queryFn: () => invoke<{ workspaces: AsanaProjectGroup[] }>('asana-projects', {}),
  });
  return { groups: q.data?.workspaces ?? [], isLoading: q.isFetching, load: q.refetch };
}

export function useAsanaActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['integration', 'asana'] });

  return {
    async selectProject(group: AsanaProjectGroup, project: { gid: string; name: string }) {
      const { error } = await supabase
        .from('integration_connections')
        .update({
          external_workspace_gid: group.gid,
          external_workspace_name: group.name,
          external_project_gid: project.gid,
          external_project_name: project.name,
        })
        .eq('provider', 'asana');
      if (error) throw error;
      await invalidate();
    },
    async sync(): Promise<{ imported: number; total: number }> {
      const result = await invoke<{ imported: number; total: number }>('asana-sync', {});
      await invalidate();
      await qc.invalidateQueries({ queryKey: ['board'] });
      return result;
    },
    async disconnect() {
      const { error } = await supabase.from('integration_connections').delete().eq('provider', 'asana');
      if (error) throw error;
      await invalidate();
    },
  };
}
