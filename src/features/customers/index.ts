import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';

export interface WorkspaceJoin {
  code: string;
  slug: string;
}

export interface ConnectedCustomer {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
}

const JOIN_BASE_URL = () => `${window.location.origin}${window.location.pathname}#/join`;

export function joinLinkUrl(slug: string): string {
  return `${JOIN_BASE_URL()}/${slug}`;
}

/** Manager's own workspace join code + link (Settings → Customers). */
export function useWorkspaceJoin(): { join: WorkspaceJoin | null; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['workspace-join'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<WorkspaceJoin | null> => {
      const { data, error } = await supabase.from('workspace_join').select('code, slug').maybeSingle();
      if (error) throw error;
      return data as WorkspaceJoin | null;
    },
  });
  if (!isSupabaseConfigured) return { join: null, isLoading: false };
  return { join: q.data ?? null, isLoading: q.isLoading };
}

export function useRegenerateJoinCode() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return async () => {
    if (!user) return;
    const { error } = await supabase.rpc('regenerate_join_code', {
      p_workspace_id: user.workspaceId,
      p_org_name: user.name,
    });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ['workspace-join'] });
  };
}

/** Look up a workspace by join code or link slug — used pre-signup (public). */
export async function lookupWorkspaceByJoinKey(key: string): Promise<{ name: string } | null> {
  const trimmed = key.trim();
  if (!trimmed) return null;
  if (!isSupabaseConfigured) {
    // Mock mode — any non-empty key resolves to the demo workspace so the
    // join wizard is fully walkable without Supabase configured.
    return { name: 'Orion Cloud' };
  }
  const { data, error } = await supabase
    .from('workspace_join')
    .select('workspace_id, workspaces(name)')
    .or(`code.eq.${trimmed.toUpperCase()},slug.eq.${trimmed.toLowerCase()}`)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as { workspaces: { name: string } | null };
  return row.workspaces ? { name: row.workspaces.name } : null;
}

export function useConnectedCustomers(): { customers: ConnectedCustomer[]; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['connected-customers'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<ConnectedCustomer[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, created_at')
        .eq('role', 'customer')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as { id: string; name: string; email: string; created_at: string }[]).map((p) => ({
        id: p.id, name: p.name, email: p.email, joinedAt: p.created_at,
      }));
    },
  });
  if (!isSupabaseConfigured) return { customers: [], isLoading: false };
  return { customers: q.data ?? [], isLoading: q.isLoading };
}
