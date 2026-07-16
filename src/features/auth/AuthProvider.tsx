import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
    opts: { name: string; role: Role; inviteCode?: string },
  ) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const MOCK_ROLE_KEY = 'ph.mockRole';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      setUser(await resolveProfile(data.session));
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
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
          setUser(MOCK_USERS[opts.role] ?? MOCK_USERS.customer);
          return { needsConfirmation: false };
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // The handle_new_user trigger reads name/role/invite_code from user
          // metadata to provision the profile + workspace. An invite_code, if
          // valid, takes priority over the role/domain logic.
          options: { data: { name: opts.name, role: opts.role, invite_code: opts.inviteCode } },
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
      async signInWithGoogle() {
        if (!isSupabaseConfigured) {
          setUser(MOCK_USERS.customer);
          return;
        }
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
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
