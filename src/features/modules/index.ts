import { useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';

export interface ProductModule {
  id: string;
  name: string;
  description: string;
  parentId?: string;
  aliases: string[];
}

interface ModuleRow {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  aliases: string[] | null;
}

export interface ModuleDraft {
  name: string;
  description?: string;
  parentId?: string | null;
  aliases?: string[];
}

function fromRow(r: ModuleRow): ProductModule {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    ...(r.parent_id ? { parentId: r.parent_id } : {}),
    aliases: r.aliases ?? [],
  };
}

/** Mock-mode catalog so the Modules page is walkable without Supabase. */
interface MockState {
  modules: ProductModule[];
  set: (m: ProductModule[]) => void;
}
const useMockModules = create<MockState>((set) => ({
  modules: [
    { id: 'mm-platform', name: 'Platform', description: 'Core platform services', aliases: [] },
    { id: 'mm-api', name: 'API', description: 'Public API and rate limits', parentId: 'mm-platform', aliases: ['rate limit', 'webhook'] },
    { id: 'mm-reports', name: 'Reports', description: 'Reporting and exports', aliases: ['csv', 'export'] },
  ],
  set: (modules) => set({ modules }),
}));

export function useModules(): { modules: ProductModule[]; isLoading: boolean } {
  const mock = useMockModules((s) => s.modules);
  const q = useQuery({
    queryKey: ['modules'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<ProductModule[]> => {
      const { data, error } = await supabase.from('modules').select('id, name, description, parent_id, aliases').order('name');
      if (error) throw error;
      return (data as ModuleRow[]).map(fromRow);
    },
  });
  if (isSupabaseConfigured) return { modules: q.data ?? [], isLoading: q.isLoading };
  return { modules: mock, isLoading: false };
}

export function useModuleActions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const mock = useMockModules();
  // Renames/deletes also rewrite backlog_items.module (DB trigger) — refresh both.
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['modules'] }), qc.invalidateQueries({ queryKey: ['board'] })]);

  return {
    async create(draft: ModuleDraft): Promise<ProductModule> {
      const name = draft.name.trim();
      if (!name) throw new Error('Module name is required.');
      if (!isSupabaseConfigured) {
        const m: ProductModule = {
          id: `mm-${Date.now()}`, name, description: draft.description ?? '',
          ...(draft.parentId ? { parentId: draft.parentId } : {}), aliases: draft.aliases ?? [],
        };
        mock.set([...mock.modules, m]);
        return m;
      }
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('modules')
        .insert({
          workspace_id: user.workspaceId, name, description: draft.description ?? '',
          parent_id: draft.parentId ?? null, aliases: draft.aliases ?? [],
        })
        .select('id, name, description, parent_id, aliases')
        .single();
      if (error) throw new Error(error.code === '23505' ? `A module named "${name}" already exists.` : error.message);
      await refresh();
      return fromRow(data as ModuleRow);
    },
    async update(id: string, draft: ModuleDraft): Promise<void> {
      const name = draft.name.trim();
      if (!name) throw new Error('Module name is required.');
      if (!isSupabaseConfigured) {
        mock.set(mock.modules.map((m) => (m.id === id ? { ...m, name, description: draft.description ?? '', aliases: draft.aliases ?? [] } : m)));
        return;
      }
      const { error } = await supabase
        .from('modules')
        .update({ name, description: draft.description ?? '', aliases: draft.aliases ?? [] })
        .eq('id', id);
      if (error) throw new Error(error.code === '23505' ? `A module named "${name}" already exists.` : error.message);
      await refresh();
    },
    async remove(id: string): Promise<void> {
      if (!isSupabaseConfigured) {
        // Mirror the DB's cascade: sub-modules go with their parent.
        const drop = new Set([id]);
        for (let grew = true; grew; ) {
          grew = false;
          for (const m of mock.modules) if (m.parentId && drop.has(m.parentId) && !drop.has(m.id)) { drop.add(m.id); grew = true; }
        }
        mock.set(mock.modules.filter((m) => !drop.has(m.id)));
        return;
      }
      const { error } = await supabase.from('modules').delete().eq('id', id);
      if (error) throw error;
      await refresh();
    },
  };
}
