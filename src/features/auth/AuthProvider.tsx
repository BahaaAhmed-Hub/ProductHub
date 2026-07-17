import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Role, User } from '@/types/domain';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { MOCK_USERS } from './mockUsers';

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Resolve the ProductHub profile (role, workspace) for an authenticated session. */
async function resolveProfile(session: Session | null): Promise<User | null> {
  if (!session) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, workspace_id, name, email, role, status, requested_role, avatar_url')
    .eq('auth_uid', session.user.id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string;
    workspace_id: string;
    name: string;
    email: string;
    role: Role;
    status: 'active' | 'pending' | null;
    requested_role: Role | null;
    avatar_url: string | null;
  };
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    email: row.email,
    role: row.role,
    initials: initialsOf(row.name),
    ...(row.status ? { status: row.status } : {}),
    ...(row.requested_role ? { requestedRole: row.requested_role } : {}),
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
  };
}

interface SignUpResult {
  needsConfirmation: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  mockMode: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    opts: { name: string; role?: Role; inviteCode?: string; joinKey?: string },
  ) => Promise<SignUpResult>;
  signInWithGoogle: (opts?: { inviteCode?: string; joinKey?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Pending user correcting their auto/self-chosen requested role before a
   * manager reviews it (e.g. Google SSO can't show the PM/Developer picker
   * before account creation, so it defaults to PM). */
  updateRequestedRole: (role: Role) => Promise<void>;
  refreshUser: () => Promise<void>;
  /** True for one render cycle after a pending user's access is approved —
   * survives the role-change redirect since it lives here, above the
   * layout that would otherwise unmount before the user sees it. */
  justApproved: boolean;
  dismissApproval: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const MOCK_ROLE_KEY = 'ph.mockRole';
const PENDING_JOIN_KEY = 'ph.pendingJoin';
const PENDING_INVITE_KEY = 'ph.pendingInvite';

/** Google OAuth can't carry our custom user_metadata pre-account-creation,
 * so handle_new_user() falls through to domain-based staff provisioning for
 * a join/invite signup done via Google. Re-home the profile via RPC once
 * the session comes back, using the key stashed before the redirect. */
async function consumePendingJoin(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const joinKey = sessionStorage.getItem(PENDING_JOIN_KEY);
  const inviteCode = sessionStorage.getItem(PENDING_INVITE_KEY);
  if (!joinKey && !inviteCode) return;
  sessionStorage.removeItem(PENDING_JOIN_KEY);
  sessionStorage.removeItem(PENDING_INVITE_KEY);
  try {
    await supabase.rpc('apply_pending_join', {
      p_key: joinKey ?? inviteCode,
      p_kind: joinKey ? 'join' : 'invite',
    });
  } catch {
    // Best-effort — if this fails the user still has a valid (if
    // mis-provisioned) account and can be fixed up manually.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [justApproved, setJustApproved] = useState(false);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (user?.status === 'pending') wasPendingRef.current = true;
    if (wasPendingRef.current && user?.status === 'active') {
      setJustApproved(true);
      wasPendingRef.current = false;
    }
  }, [user?.status]);

  useEffect(() => {
    if (!isSupabaseConfigured || user?.status !== 'pending') return;
    const id = setInterval(() => {
      supabase.auth.getSession().then(async ({ data }) => setUser(await resolveProfile(data.session)));
    }, 15_000);
    return () => clearInterval(id);
  }, [user?.status]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Mock mode: restore last-selected role, else default to Customer
      // (lands the demo on the fully-built support flow, not a placeholder).
      const saved = (localStorage.getItem(MOCK_ROLE_KEY) as Role | null) ?? 'customer';
      setUser(MOCK_USERS[saved] ?? MOCK_USERS.customer);
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      await consumePendingJoin();
      setUser(await resolveProfile(data.session));
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      await consumePendingJoin();
      setUser(await resolveProfile(session));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      mockMode: !isSupabaseConfigured,
      async signInWithPassword(email, password) {
        if (!isSupabaseConfigured) {
          setUser(MOCK_USERS.customer);
          return;
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const profile = await resolveProfile(data.session);
        if (!profile) throw new Error('Signed in, but no workspace profile is linked to this account.');
        setUser(profile);
      },
      async signUp(email, password, opts) {
        if (!isSupabaseConfigured) {
          setUser(MOCK_USERS[opts.role ?? 'customer'] ?? MOCK_USERS.customer);
          return { needsConfirmation: false };
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // The handle_new_user trigger reads name/role/invite_code/join_code
          // from user metadata to provision the profile + workspace. Priority:
          // join_code/join_slug (end-user) > invite_code (stakeholder link) >
          // role/domain logic (staff).
          options: {
            data: {
              name: opts.name,
              role: opts.role,
              invite_code: opts.inviteCode,
              join_code: opts.joinKey,
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          // Email confirmation disabled → signed in immediately.
          const profile = await resolveProfile(data.session);
          setUser(profile);
          return { needsConfirmation: false };
        }
        // Confirmation required → user must verify via email, then sign in.
        return { needsConfirmation: true };
      },
      async signInWithGoogle(opts) {
        if (!isSupabaseConfigured) {
          setUser(MOCK_USERS.customer);
          return;
        }
        // Stash the invite/join key so it can be applied after the OAuth
        // redirect returns (Google doesn't let us pass custom user_metadata
        // through the provider — raw_user_meta_data is populated from
        // Google's own profile fields only).
        if (opts?.inviteCode) sessionStorage.setItem('ph.pendingInvite', opts.inviteCode);
        if (opts?.joinKey) sessionStorage.setItem('ph.pendingJoin', opts.joinKey);
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          // Return to the app root (strip any hash route). PKCE flow returns a
          // ?code= query param, which HashRouter ignores and supabase-js exchanges.
          options: { redirectTo: window.location.href.split('#')[0] },
        });
        if (error) throw error;
      },
      async signOut() {
        if (isSupabaseConfigured) await supabase.auth.signOut();
        queryClient.clear();
        setUser(null);
      },
      async updateRequestedRole(role) {
        if (!isSupabaseConfigured || !user) return;
        const { error } = await supabase.from('profiles').update({ requested_role: role }).eq('id', user.id);
        if (error) throw error;
        setUser({ ...user, requestedRole: role });
      },
      async refreshUser() {
        if (!isSupabaseConfigured) return;
        const { data } = await supabase.auth.getSession();
        setUser(await resolveProfile(data.session));
      },
      justApproved,
      dismissApproval() {
        setJustApproved(false);
      },
    }),
    [user, loading, justApproved],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
