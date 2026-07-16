import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import type { BoardStatus } from '@/types/domain';
import { useBoardStore } from './store';
import { addRequestToBoard, listBoardItems, listTriageRequests, updateBoardStatus, updateRiceScore, updateItemFields, listItemNotes, addItemNote } from './api';
import type { BoardItem, ItemNote, TriageRequest } from './types';

/** camelCase BoardItem fields → snake_case DB columns for updateItemFields. */
const COLMAP: Record<string, string> = {
  riceScore: 'rice_score',
  wsjfScore: 'wsjf_score',
  effort: 'effort',
  scoreInputs: 'score_inputs',
  swimlane: 'swimlane',
  releaseId: 'release_id',
  planBucket: 'plan_bucket',
  boardStatus: 'board_status',
};

export function useBoardItems(): { items: BoardItem[]; isLoading: boolean } {
  const mock = useBoardStore((s) => s.items);
  const q = useQuery({ queryKey: ['board'], queryFn: listBoardItems, enabled: isSupabaseConfigured });
  if (isSupabaseConfigured) return { items: q.data ?? [], isLoading: q.isLoading };
  return { items: mock, isLoading: false };
}

export function useMoveItem() {
  const qc = useQueryClient();
  const mockMove = useBoardStore((s) => s.moveItem);
  return async (id: string, status: BoardStatus): Promise<void> => {
    if (isSupabaseConfigured) {
      await updateBoardStatus(id, status);
      await qc.invalidateQueries({ queryKey: ['board'] });
      return;
    }
    mockMove(id, status);
  };
}

export function useUpdateRice() {
  const qc = useQueryClient();
  const mockSet = useBoardStore((s) => s.setRice);
  return async (id: string, score: number): Promise<void> => {
    if (isSupabaseConfigured) {
      await updateRiceScore(id, score);
      await qc.invalidateQueries({ queryKey: ['board'] });
      return;
    }
    mockSet(id, score);
  };
}

export function useUpdateItem() {
  const qc = useQueryClient();
  const patch = useBoardStore((s) => s.patch);
  return async (id: string, fields: Partial<BoardItem>): Promise<void> => {
    if (isSupabaseConfigured) {
      const dbFields: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) dbFields[COLMAP[k] ?? k] = v;
      await updateItemFields(id, dbFields);
      await qc.invalidateQueries({ queryKey: ['board'] });
      return;
    }
    patch(id, fields);
  };
}

export function useItemNotes(itemId: string | undefined): { notes: ItemNote[]; isLoading: boolean } {
  const mock = useBoardStore((s) => (itemId ? s.notes[itemId] ?? [] : []));
  const q = useQuery({
    queryKey: ['notes', itemId],
    queryFn: () => listItemNotes(itemId as string),
    enabled: isSupabaseConfigured && !!itemId,
  });
  if (isSupabaseConfigured) return { notes: q.data ?? [], isLoading: q.isLoading };
  return { notes: mock, isLoading: false };
}

export function useAddNote(itemId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const mockAdd = useBoardStore((s) => s.addNote);
  return async (body: string, internal: boolean): Promise<void> => {
    if (!itemId) return;
    if (isSupabaseConfigured) {
      if (!user) throw new Error('Not authenticated');
      await addItemNote(itemId, body, internal, user.id);
      await qc.invalidateQueries({ queryKey: ['notes', itemId] });
      return;
    }
    mockAdd(itemId, {
      id: `n-${Date.now()}`,
      author: user?.name ?? 'You',
      initials: (user?.initials ?? 'YO').slice(0, 2),
      ago: 'just now',
      body,
      internal,
    });
  };
}

export function useTriageRequests(): { requests: TriageRequest[]; isLoading: boolean } {
  const mock = useBoardStore((s) => s.triage);
  const q = useQuery({ queryKey: ['triage'], queryFn: listTriageRequests, enabled: isSupabaseConfigured });
  if (isSupabaseConfigured) return { requests: q.data ?? [], isLoading: q.isLoading };
  return { requests: mock, isLoading: false };
}

export function useAddToBoard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const mockAdd = useBoardStore((s) => s.addToBoard);
  return async (t: TriageRequest): Promise<void> => {
    if (isSupabaseConfigured) {
      if (!user) throw new Error('Not authenticated');
      await addRequestToBoard(t, user.workspaceId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['triage'] }),
        qc.invalidateQueries({ queryKey: ['board'] }),
      ]);
      return;
    }
    mockAdd(t);
  };
}
