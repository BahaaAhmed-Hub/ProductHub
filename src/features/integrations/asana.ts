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

const REDIRECT_URI = () => window.location.href.split('#')[0];
const EXPECTED_STATE_KEY = 'ph.asanaOAuthExpectedState';
const RETURNED_CODE_KEY = 'ph.asanaOAuthCode';
const RETURNED_STATE_KEY = 'ph.asanaOAuthState';
const POPUP_MESSAGE_SOURCE = 'ph-asana-oauth';

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
  sessionStorage.setItem(EXPECTED_STATE_KEY, authorize.state);
  popup.location.href = authorize.url;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      settled = true;
      window.removeEventListener('message', onMessage);
      clearInterval(watcher);
      fn();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.source !== POPUP_MESSAGE_SOURCE) return;
      const { code, state } = event.data as { code?: string; state?: string };
      if (!code || !state) return finish(() => reject(new Error('Asana did not return an authorization code.')));
      if (state !== sessionStorage.getItem(EXPECTED_STATE_KEY)) {
        return finish(() => reject(new Error('Asana sign-in could not be verified (state mismatch) — please try again.')));
      }
      sessionStorage.removeItem(EXPECTED_STATE_KEY);
      finish(() => {
        invoke('asana-oauth', { action: 'callback', code, redirectUri: REDIRECT_URI() })
          .then(() => queryClient.invalidateQueries({ queryKey: ['integration', 'asana'] }))
          .then(resolve)
          .catch(reject);
      });
    };
    window.addEventListener('message', onMessage);
    // The popup can also be closed by hand before finishing — that's the
    // only way to detect a user-abandoned flow (there's no cancel event).
    const watcher = setInterval(() => {
      if (popup.closed && !settled) finish(() => reject(new Error('The Asana authorization window was closed before finishing.')));
    }, 400);
  });
}

/** Runs inside the popup once Asana redirects it back to our origin (the
 * inline script in index.html has already captured ?code&state into this
 * window's own sessionStorage). Forwards them to the opener, which does the
 * actual verification + exchange with its own untouched session state —
 * the popup just navigated cross-origin and back, so its own sessionStorage
 * can't be trusted as the source of truth for the pre-redirect "expected
 * state" value. Returns true if a pending callback was found (either
 * forwarded to an opener, or — no opener, e.g. popups were blocked and this
 * somehow still ran as a plain redirect — resolved locally as a fallback). */
export async function consumePendingAsanaOAuth(): Promise<boolean> {
  const code = sessionStorage.getItem(RETURNED_CODE_KEY);
  const state = sessionStorage.getItem(RETURNED_STATE_KEY);
  sessionStorage.removeItem(RETURNED_CODE_KEY);
  sessionStorage.removeItem(RETURNED_STATE_KEY);
  if (!code || !state) return false;

  if (window.opener) {
    window.opener.postMessage({ source: POPUP_MESSAGE_SOURCE, code, state }, window.location.origin);
    window.close();
    return true;
  }

  // Fallback: no opener (popup was blocked and connectAsana's own error
  // never fired, or the URL was reopened directly) — verify and exchange
  // locally instead of silently doing nothing.
  const expected = sessionStorage.getItem(EXPECTED_STATE_KEY);
  sessionStorage.removeItem(EXPECTED_STATE_KEY);
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
