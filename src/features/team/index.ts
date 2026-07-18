import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { invoke } from '@/lib/edgeFunctions';
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
  // 'active': normal member. 'pending': domain signup awaiting a manager's
  // approve/decline. 'invited': manager sent a direct email invite and the
  // person hasn't set a password + signed in yet.
  status: 'active' | 'pending' | 'invited';
  isSelf: boolean;
  invitedAt?: string;
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
        .select('id, name, email, role, status, invited_at')
        .order('name');
      if (error) throw error;
      return (data as { id: string; name: string; email: string; role: Role; status: Member['status'] | null; invited_at: string | null }[]).map((p) => ({
        id: p.id, name: p.name, email: p.email, role: p.role,
        status: p.status ?? 'active',
        isSelf: p.id === user?.id,
        ...(p.invited_at ? { invitedAt: p.invited_at } : {}),
      }));
    },
  });
  if (!isSupabaseConfigured) return { members: [], isLoading: false };
  return { members: q.data ?? [], isLoading: q.isLoading };
}

function initialsOf(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

/** The roster offered by any assignee picker (Backlog bulk-assign, item
 * detail panel) — active team members in real mode, or the fixture roster
 * already used by mock board items so the picker stays walkable without
 * Supabase configured. */
export function useAssigneeRoster(): { id: string; name: string; initials: string }[] {
  const { members } = useTeamMembers();
  if (isSupabaseConfigured) {
    return members.filter((m) => m.status === 'active').map((m) => ({ id: m.id, name: m.name, initials: initialsOf(m.name) }));
  }
  return [
    { id: 'mock-ar', name: 'Amir R.', initials: 'AR' },
    { id: 'mock-sk', name: 'Sara K.', initials: 'SK' },
    { id: 'mock-dr', name: 'Devon R.', initials: 'DR' },
  ];
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

/** Direct email invite: manager types an email + role, the invite-member
 * Edge Function creates an unconfirmed auth user (service role) and emails
 * them a "set your password" link. The same call resends the invite for an
 * already-invited (still unconfirmed) email — Supabase's admin invite API
 * treats a second call for an unconfirmed user as a resend rather than an
 * error, so "Invite" and "Resend" both go through this one function. */
export function useInviteMemberActions() {
  const qc = useQueryClient();
  return {
    async invite(email: string, role: Role): Promise<void> {
      if (!isSupabaseConfigured) throw new Error('Inviting members requires a configured Supabase project.');
      const redirectTo = `${window.location.origin}${window.location.pathname}#/accept-invite`;
      await invoke('invite-member', { email, role, redirectTo });
      await qc.invalidateQueries({ queryKey: ['team'] });
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
