import { create } from 'zustand';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';

export type Bucket = 'now' | 'next' | 'later';

export interface RoadmapCard {
  id: string;
  title: string;
  theme?: string;
  bucket: Bucket;
  isPublished: boolean;
}

export const BUCKETS: { key: Bucket; label: string; sub: string; dot: string }[] = [
  { key: 'now', label: 'Now', sub: 'This quarter', dot: '#1B2A4A' },
  { key: 'next', label: 'Next', sub: 'Next quarter', dot: '#D97706' },
  { key: 'later', label: 'Later', sub: 'Exploring', dot: '#8A8983' },
];

const SEED: RoadmapCard[] = [
  { id: 'r1', title: 'Usage-based billing tier', theme: 'Billing', bucket: 'now', isPublished: true },
  { id: 'r2', title: 'Automatic Enterprise rate limits', theme: 'Platform', bucket: 'now', isPublished: true },
  { id: 'r3', title: 'Slack actions on tickets', theme: 'Integrations', bucket: 'next', isPublished: true },
  { id: 'r4', title: 'Bulk import from Asana', theme: 'Integrations', bucket: 'next', isPublished: false },
  { id: 'r5', title: 'Dark mode', theme: 'UX', bucket: 'later', isPublished: false },
];

interface MockState {
  cards: RoadmapCard[];
  add: (title: string, bucket: Bucket) => void;
  move: (id: string, bucket: Bucket) => void;
  togglePublish: (id: string) => void;
}
const useMock = create<MockState>((set) => ({
  cards: SEED,
  add: (title, bucket) =>
    set((s) => ({ cards: [...s.cards, { id: `r-${s.cards.length + 1}-${bucket}`, title, bucket, isPublished: false }] })),
  move: (id, bucket) => set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, bucket } : c)) })),
  togglePublish: (id) =>
    set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, isPublished: !c.isPublished } : c)) })),
}));

interface Row { id: string; title: string; theme: string | null; bucket: Bucket; is_published: boolean }
const mapRow = (r: Row): RoadmapCard => ({
  id: r.id, title: r.title, bucket: r.bucket, isPublished: r.is_published,
  ...(r.theme ? { theme: r.theme } : {}),
});

async function listRoadmap(): Promise<RoadmapCard[]> {
  const { data, error } = await supabase
    .from('roadmap_items')
    .select('id, title, theme, bucket, is_published')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as unknown as Row[]).map(mapRow);
}

export function useRoadmap(): { cards: RoadmapCard[]; isLoading: boolean } {
  const mock = useMock((s) => s.cards);
  const q = useQuery({ queryKey: ['roadmap'], queryFn: listRoadmap, enabled: isSupabaseConfigured });
  if (isSupabaseConfigured) return { cards: q.data ?? [], isLoading: q.isLoading };
  return { cards: mock, isLoading: false };
}

export function useRoadmapActions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const mock = useMock();
  const refresh = () => qc.invalidateQueries({ queryKey: ['roadmap'] });
  return {
    async add(title: string, bucket: Bucket) {
      if (!isSupabaseConfigured) return mock.add(title, bucket);
      if (!user) return;
      const { error } = await supabase.from('roadmap_items').insert({ workspace_id: user.workspaceId, title, bucket });
      if (error) throw error;
      await refresh();
    },
    async move(id: string, bucket: Bucket) {
      if (!isSupabaseConfigured) return mock.move(id, bucket);
      const { error } = await supabase.from('roadmap_items').update({ bucket }).eq('id', id);
      if (error) throw error;
      await refresh();
    },
    async togglePublish(id: string, current: boolean) {
      if (!isSupabaseConfigured) return mock.togglePublish(id);
      const { error } = await supabase.from('roadmap_items').update({ is_published: !current }).eq('id', id);
      if (error) throw error;
      await refresh();
    },
  };
}
