import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Role } from '@/types/domain';

export interface PendingMember {
  id: string;
  name: string;
  email: string;
  requestedRole: Role;
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
