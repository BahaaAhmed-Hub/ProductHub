// Shared Asana OAuth + API helpers used by asana-oauth, asana-projects, and
// asana-sync. Client secret never leaves this server-side boundary.
export const ASANA_AUTHORIZE_URL = 'https://app.asana.com/-/oauth_authorize';
export const ASANA_TOKEN_URL = 'https://app.asana.com/-/oauth_token';
export const ASANA_API_BASE = 'https://app.asana.com/api/1.0';

export interface AsanaTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
}

function clientCreds() {
  const clientId = Deno.env.get('ASANA_CLIENT_ID');
  const clientSecret = Deno.env.get('ASANA_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('ASANA_CLIENT_ID / ASANA_CLIENT_SECRET are not configured.');
  return { clientId, clientSecret };
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { clientId } = clientCreds();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  return `${ASANA_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<AsanaTokens> {
  const { clientId, clientSecret } = clientCreds();
  const res = await fetch(ASANA_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });
  if (!res.ok) throw new Error(`Asana token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function refreshTokens(refreshToken: string): Promise<AsanaTokens> {
  const { clientId, clientSecret } = clientCreds();
  const res = await fetch(ASANA_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Asana token refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface Connection {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

/** Returns a valid access token, refreshing (and persisting the refresh) if
 * the stored one has expired. Callers pass the same authed client used to
 * load the connection row so the update still goes through RLS. */
export async function ensureFreshToken(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  connection: Connection,
): Promise<string> {
  const expiresAt = new Date(connection.expires_at).getTime();
  // Refresh a minute early so an in-flight request never races the expiry.
  if (expiresAt - Date.now() > 60_000) return connection.access_token;

  const fresh = await refreshTokens(connection.refresh_token);
  const expires_at = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
  await supabase
    .from('integration_connections')
    .update({ access_token: fresh.access_token, refresh_token: fresh.refresh_token, expires_at })
    .eq('id', connection.id);
  return fresh.access_token;
}

export async function asanaFetch(accessToken: string, path: string): Promise<unknown> {
  const res = await fetch(`${ASANA_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Asana API error ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.data;
}

interface AsanaPage<T> {
  data: T[];
  next_page: { offset: string } | null;
}

/** Like asanaFetch but follows Asana's offset-based pagination (next_page is
 * a sibling of "data", not nested under it — asanaFetch discards it), so a
 * project with more than one page of tasks doesn't silently lose the tail. */
export async function asanaFetchAllPages<T>(accessToken: string, path: string): Promise<T[]> {
  const out: T[] = [];
  let url = `${ASANA_API_BASE}${path}`;
  for (;;) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Asana API error ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as AsanaPage<T>;
    out.push(...body.data);
    if (!body.next_page) return out;
    const sep = path.includes('?') ? '&' : '?';
    url = `${ASANA_API_BASE}${path}${sep}offset=${body.next_page.offset}`;
  }
}

/** Runs fn over items with at most `limit` in flight — comments need one
 * API call per task, and firing them all at once risks Asana's rate limits
 * on any project with more than a handful of tasks. */
export async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
