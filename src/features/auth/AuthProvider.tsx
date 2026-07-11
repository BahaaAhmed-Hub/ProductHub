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
    .select('id, workspace_id, name, email, role, avatar_url')
    .eq('auth_uid', session.user.id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string;
    workspace_id: string;
    name: string;
    email: string;
    role: Role;
    avatar_url: string | null;
  };
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    email: row.email,
    role: row.role,
    initials: initialsOf(row.name),
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
  };
}

interface AuthState {
  user: User | null;
  loading: boolean;
  mockMode: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Dev-only: switch the active role while running against mock data. */
  setMockRole: (role: Role) => void;
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
      async signInWithGoogle() {
        if (!isSupabaseConfigured) {
          setUser(MOCK_USERS.customer);
          return;
        }
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
      },
      async signOut() {
        if (isSupabaseConfigured) await supabase.auth.signOut();
        setUser(null);
      },
      setMockRole(role) {
        localStorage.setItem(MOCK_ROLE_KEY, role);
        setUser(MOCK_USERS[role]);
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
