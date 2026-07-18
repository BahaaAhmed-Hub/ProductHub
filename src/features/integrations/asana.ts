import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';

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

/** Exported so the UI can display the exact value being sent — Asana's
 * "redirect_uri does not match" error never echoes back what was sent, so
 * without this the only way to debug a mismatch is guessing. */
export const REDIRECT_URI = () => window.location.href.split('#')[0];
// localStorage, not sessionStorage — it's origin-scoped rather than
// browsing-context-scoped, so it survives Asana's own pages severing
// window.opener via Cross-Origin-Opener-Policy (postMessage/window.opener
// are unreliable the moment a third party's redirect is in the loop; a
// plain origin-wide store + polling isn't).
const EXPECTED_STATE_KEY = 'ph.asanaOAuthExpectedState';
const RESULT_KEY = 'ph.asanaOAuthResult';
// sessionStorage — set by the inline capture script in index.html, read
// once by whichever window lands on the redirect URI (the popup, normally).
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

/** Connect Asana in a popup, the way every other "Connect X" integration
 * works — the main app never navigates away. The popup must be opened
 * synchronously (before any await) or browsers block it as unsolicited;
 * it's opened blank first and redirected once the authorize URL comes back. */
export async function connectAsana(): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Connecting Asana requires a configured Supabase project (mock mode has no backend to OAuth against).');
  }
  const popup = window.open('', 'ph-asana-oauth', 'width=600,height=720');
  if (!popup) {
    throw new Error('Your browser blocked the popup — allow popups for this site and try again.');
  }

  let authorize: { url: string; state: string };
  try {
    authorize = await invoke<{ url: string; state: string }>('asana-oauth', {
      action: 'authorize',
      redirectUri: REDIRECT_URI(),
    });
  } catch (err) {
    popup.close();
    throw err;
  }
  localStorage.removeItem(RESULT_KEY);
  localStorage.setItem(EXPECTED_STATE_KEY, authorize.state);
  popup.location.href = authorize.url;

  return new Promise((resolve, reject) => {
    const watcher = setInterval(() => {
      const raw = localStorage.getItem(RESULT_KEY);
      if (raw) {
        clearInterval(watcher);
        localStorage.removeItem(RESULT_KEY);
        const expected = localStorage.getItem(EXPECTED_STATE_KEY);
        localStorage.removeItem(EXPECTED_STATE_KEY);
        const { code, state } = JSON.parse(raw) as { code: string; state: string };
        if (state !== expected) {
          reject(new Error('Asana sign-in could not be verified (state mismatch) — please try again.'));
          return;
        }
        invoke('asana-oauth', { action: 'callback', code, redirectUri: REDIRECT_URI() })
          .then(() => queryClient.invalidateQueries({ queryKey: ['integration', 'asana'] }))
          .then(resolve)
          .catch(reject);
        return;
      }
      // The popup can also be closed by hand before finishing — that's the
      // only way to detect a user-abandoned flow (there's no cancel event).
      if (popup.closed) {
        clearInterval(watcher);
        reject(new Error('The Asana authorization window was closed before finishing.'));
      }
    }, 400);
  });
}

/** Runs inside the popup once Asana redirects it back to our origin (the
 * inline script in index.html has already captured ?code&state into this
 * window's own sessionStorage). Drops the raw code/state into localStorage
 * for the opener's connectAsana() to pick up, then closes itself — the
 * verification + exchange happens over there, not here, since a plain
 * origin-scoped store survives the cross-origin round trip in a way
 * window.opener/postMessage don't reliably. Returns true if a pending
 * callback was found. */
export async function consumePendingAsanaOAuth(): Promise<boolean> {
  const code = sessionStorage.getItem(RETURNED_CODE_KEY);
  const state = sessionStorage.getItem(RETURNED_STATE_KEY);
  sessionStorage.removeItem(RETURNED_CODE_KEY);
  sessionStorage.removeItem(RETURNED_STATE_KEY);
  if (!code || !state) return false;

  localStorage.setItem(RESULT_KEY, JSON.stringify({ code, state }));
  window.close();
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
