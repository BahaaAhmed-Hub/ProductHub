import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Role } from '@/types/domain';

export interface PendingMember {
  id: string;
  name: string;
  email: string;
  requestedRole: Role;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'pending';
  isSelf: boolean;
}

export interface Invite {
  id: string;
  code: string;
  role: Role;
  createdAt: string;
  expiresAt?: string;
}

export function usePendingMembers(): { pending: PendingMember[]; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['pending-members'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<PendingMember[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, requested_role')
        .eq('status', 'pending')
        .order('name');
      if (error) throw error;
      return (data as { id: string; name: string; email: string; requested_role: Role | null }[]).map((p) => ({
        id: p.id, name: p.name, email: p.email, requestedRole: (p.requested_role ?? 'customer') as Role,
      }));
    },
  });
  if (!isSupabaseConfigured) return { pending: [], isLoading: false };
  return { pending: q.data ?? [], isLoading: q.isLoading };
}

export function useTeamMembers(): { members: Member[]; isLoading: boolean } {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ['team'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, status')
        .order('name');
      if (error) throw error;
      return (data as { id: string; name: string; email: string; role: Role; status: 'active' | 'pending' | null }[]).map((p) => ({
        id: p.id, name: p.name, email: p.email, role: p.role,
        status: p.status ?? 'active',
        isSelf: p.id === user?.id,
      }));
    },
  });
  if (!isSupabaseConfigured) return { members: [], isLoading: false };
  return { members: q.data ?? [], isLoading: q.isLoading };
}

export function useChangeMemberRole() {
  const qc = useQueryClient();
  return async (memberId: string, role: Role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', memberId);
    if (error) throw error;
    await supabase.from('notifications').insert({
      user_id: memberId, kind: 'role_change', title: 'Your role changed',
      body: `An admin changed your role to ${role}.`,
    });
    await qc.invalidateQueries({ queryKey: ['team'] });
  };
}

export function useInvites(): { invites: Invite[]; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['invites'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from('workspace_invites')
        .select('id, code, role, created_at, expires_at')
        .eq('revoked', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as { id: string; code: string; role: Role; created_at: string; expires_at: string | null }[]).map((i) => ({
        id: i.id, code: i.code, role: i.role, createdAt: i.created_at,
        ...(i.expires_at ? { expiresAt: i.expires_at } : {}),
      }));
    },
  });
  if (!isSupabaseConfigured) return { invites: [], isLoading: false };
  return { invites: q.data ?? [], isLoading: q.isLoading };
}

export function useInviteActions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return {
    async create(role: Role) {
      if (!user) return;
      const { error } = await supabase
        .from('workspace_invites')
        .insert({ workspace_id: user.workspaceId, role, created_by: user.id });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['invites'] });
    },
    async revoke(id: string) {
      const { error } = await supabase.from('workspace_invites').update({ revoked: true }).eq('id', id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['invites'] });
    },
  };
}

export function useMemberReview() {
  const qc = useQueryClient();
  async function notify(userId: string, title: string, body: string) {
    await supabase.from('notifications').insert({ user_id: userId, kind: 'approval', title, body });
  }
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['pending-members'] }),
      qc.invalidateQueries({ queryKey: ['team'] }),
    ]);
  }
  return {
    async approve(m: PendingMember) {
      const { error } = await supabase
        .from('profiles')
        .update({ role: m.requestedRole, status: 'active' })
        .eq('id', m.id);
      if (error) throw error;
      await notify(m.id, 'Access approved', `You're now active as ${m.requestedRole}.`);
      await refresh();
    },
    async decline(m: PendingMember) {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'customer', status: 'active' })
        .eq('id', m.id);
      if (error) throw error;
      await notify(m.id, 'Role request declined', 'You have Customer access. Contact your admin to change it.');
      await refresh();
    },
  };
}
