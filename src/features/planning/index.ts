import { create } from 'zustand';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';

export interface Release {
  id: string;
  name: string;
  status: string;
  targetDate?: string;
}
export interface Sprint {
  id: string;
  name: string;
  startsAt?: string;
  endsAt?: string;
  goal?: string;
}
export interface Criterion {
  key: string;
  label: string;
  weight: number;
}
export interface PriModel {
  id: string;
  name: string;
  criteria: Criterion[];
}
export interface Automation {
  id: string;
  name: string;
  trigger: string;
  action: string;
  active: boolean;
  runs: number;
}

const DEFAULT_AUTOMATIONS: Omit<Automation, 'id'>[] = [
  { name: 'Auto-triage critical bugs', trigger: 'Request created · priority = Critical', action: 'Assign to on-call · notify #eng-critical', active: true, runs: 0 },
  { name: 'Escalate SLA at risk', trigger: 'SLA < 1h remaining', action: 'Notify manager · raise priority', active: true, runs: 0 },
  { name: 'Close stale queries', trigger: 'Query · no reply for 14 days', action: 'Mark resolved · email customer', active: false, runs: 0 },
  { name: 'Sync released items to Slack', trigger: 'Item moved to Released', action: 'Post to #product-updates', active: true, runs: 0 },
];

// ---------- mock fallback (local dev) ----------
interface MockState {
  releases: Release[];
  sprints: Sprint[];
  models: PriModel[];
  automations: Automation[];
  addRelease: (name: string) => void;
  addModel: (name: string, criteria: Criterion[]) => void;
  removeModel: (id: string) => void;
  toggleAutomation: (id: string) => void;
}
const useMock = create<MockState>((set) => ({
  automations: DEFAULT_AUTOMATIONS.map((a, i) => ({ ...a, id: `a${i}`, runs: [128, 43, 7, 214][i] ?? 0 })),
  toggleAutomation: (id) => set((s) => ({ automations: s.automations.map((a) => (a.id === id ? { ...a, active: !a.active } : a)) })),
  releases: [
    { id: 'rel-43', name: 'Release 4.3', status: 'on_track', targetDate: 'Aug 12' },
    { id: 'rel-44', name: 'Release 4.4', status: 'planned', targetDate: 'Sep 9' },
  ],
  sprints: [{ id: 'sp-24', name: 'Sprint 24', startsAt: 'Jun 9', endsAt: 'Jun 23', goal: 'Enterprise reliability' }],
  models: [
    { id: 'm1', name: 'Q4 exec model', criteria: [
      { key: 'revenue', label: 'Revenue impact', weight: 40 },
      { key: 'effort', label: 'Effort (inverse)', weight: 30 },
      { key: 'risk', label: 'Risk reduction', weight: 30 },
    ] },
  ],
  addRelease: (name) => set((s) => ({ releases: [...s.releases, { id: `rel-${s.releases.length}`, name, status: 'planned' }] })),
  addModel: (name, criteria) => set((s) => ({ models: [...s.models, { id: `m-${s.models.length + 1}`, name, criteria }] })),
  removeModel: (id) => set((s) => ({ models: s.models.filter((m) => m.id !== id) })),
}));

// ---------- releases ----------
export function useReleases(): { releases: Release[]; isLoading: boolean } {
  const mock = useMock((s) => s.releases);
  const q = useQuery({
    queryKey: ['releases'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<Release[]> => {
      const { data, error } = await supabase
        .from('releases')
        .select('id, name, status, target_date')
        .order('target_date', { ascending: true });
      if (error) throw error;
      return (data as { id: string; name: string; status: string; target_date: string | null }[]).map((r) => ({
        id: r.id, name: r.name, status: r.status, ...(r.target_date ? { targetDate: r.target_date } : {}),
      }));
    },
  });
  if (isSupabaseConfigured) return { releases: q.data ?? [], isLoading: q.isLoading };
  return { releases: mock, isLoading: false };
}

export function useSprints(): Sprint[] {
  const mock = useMock((s) => s.sprints);
  const q = useQuery({
    queryKey: ['sprints'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<Sprint[]> => {
      const { data, error } = await supabase.from('sprints').select('id, name, starts_at, ends_at, goal');
      if (error) throw error;
      return (data as { id: string; name: string; starts_at: string | null; ends_at: string | null; goal: string | null }[]).map((s) => ({
        id: s.id, name: s.name,
        ...(s.starts_at ? { startsAt: s.starts_at } : {}),
        ...(s.ends_at ? { endsAt: s.ends_at } : {}),
        ...(s.goal ? { goal: s.goal } : {}),
      }));
    },
  });
  if (isSupabaseConfigured) return q.data ?? [];
  return mock;
}

export function useModels(): { models: PriModel[]; isLoading: boolean } {
  const mock = useMock((s) => s.models);
  const q = useQuery({
    queryKey: ['models'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<PriModel[]> => {
      const { data, error } = await supabase.from('prioritization_models').select('id, name, criteria');
      if (error) throw error;
      return (data as { id: string; name: string; criteria: Criterion[] }[]).map((m) => ({
        id: m.id, name: m.name, criteria: m.criteria ?? [],
      }));
    },
  });
  if (isSupabaseConfigured) return { models: q.data ?? [], isLoading: q.isLoading };
  return { models: mock, isLoading: false };
}

export function useAutomations(): { automations: Automation[]; isLoading: boolean } {
  const mock = useMock((s) => s.automations);
  const q = useQuery({
    queryKey: ['automations'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<Automation[]> => {
      const { data, error } = await supabase
        .from('automations')
        .select('id, name, trigger, action, active, runs')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Automation[];
    },
  });
  if (isSupabaseConfigured) return { automations: q.data ?? [], isLoading: q.isLoading };
  return { automations: mock, isLoading: false };
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  const mock = useMock((s) => s.toggleAutomation);
  return async (id: string, active: boolean) => {
    if (!isSupabaseConfigured) return mock(id);
    const { error } = await supabase.from('automations').update({ active }).eq('id', id);
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ['automations'] });
  };
}

export function usePlanningActions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const mock = useMock();
  const ws = user?.workspaceId;
  return {
    async addRelease(name: string) {
      if (!isSupabaseConfigured) return mock.addRelease(name);
      if (!ws) return;
      const { error } = await supabase.from('releases').insert({ workspace_id: ws, name, status: 'planned' });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['releases'] });
    },
    async addModel(name: string, criteria: Criterion[]) {
      if (!isSupabaseConfigured) return mock.addModel(name, criteria);
      if (!ws) return;
      const { error } = await supabase.from('prioritization_models').insert({ workspace_id: ws, name, criteria });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['models'] });
    },
    async removeModel(id: string) {
      if (!isSupabaseConfigured) return mock.removeModel(id);
      const { error } = await supabase.from('prioritization_models').delete().eq('id', id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['models'] });
    },
  };
}
