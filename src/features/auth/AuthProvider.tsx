import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Role, User } from '@/types/domain';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { MOCK_USERS } from './mockUsers';

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
      // Mock mode: restore last-selected role, else default to PM.
      const saved = (localStorage.getItem(MOCK_ROLE_KEY) as Role | null) ?? 'pm';
      setUser(MOCK_USERS[saved] ?? MOCK_USERS.pm);
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      // TODO(M1): resolve the profile row (role, workspace) for data.session.user.
      setUser(data.session ? MOCK_USERS.pm : null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session ? MOCK_USERS.pm : null);
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
          setUser(MOCK_USERS.pm);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signInWithGoogle() {
        if (!isSupabaseConfigured) {
          setUser(MOCK_USERS.pm);
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
