import { create } from 'zustand';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body?: string;
  read: boolean;
  ago: string;
}

function ago(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 3_600_000) return `${Math.max(1, Math.floor(d / 60_000))}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

// mock fallback
interface MockState {
  notes: Notification[];
  markAll: () => void;
}
const useMock = create<MockState>((set) => ({
  notes: [
    { id: 'm1', kind: 'sla', title: 'BUG-0042 nearing SLA', body: '0h 47m to first-response target', read: false, ago: '12m ago' },
    { id: 'm2', kind: 'triage', title: '3 requests awaiting triage', body: 'New from Orion Cloud', read: false, ago: '1h ago' },
    { id: 'm3', kind: 'release', title: 'Release 4.2 shipped', body: 'Custom SLA tiers went live', read: true, ago: '2d ago' },
  ],
  markAll: () => set((s) => ({ notes: s.notes.map((n) => ({ ...n, read: true })) })),
}));

interface Row { id: string; kind: string; title: string; body: string | null; read_at: string | null; created_at: string }

export function useNotifications(): { notes: Notification[]; unread: number; isLoading: boolean } {
  const mock = useMock((s) => s.notes);
  const q = useQuery({
    queryKey: ['notifications'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, kind, title, body, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as Row[]).map((r) => ({
        id: r.id, kind: r.kind, title: r.title, read: !!r.read_at, ago: ago(r.created_at),
        ...(r.body ? { body: r.body } : {}),
      }));
    },
  });
  const notes = isSupabaseConfigured ? q.data ?? [] : mock;
  return { notes, unread: notes.filter((n) => !n.read).length, isLoading: isSupabaseConfigured ? q.isLoading : false };
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  const mock = useMock((s) => s.markAll);
  return async () => {
    if (!isSupabaseConfigured) return mock();
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ['notifications'] });
  };
}
