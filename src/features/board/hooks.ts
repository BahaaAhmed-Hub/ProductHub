import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import type { BoardStatus } from '@/types/domain';
import { useBoardStore } from './store';
import {
  addRequestToBoard, listBoardItems, listTriageRequests, updateBoardStatus, updateRiceScore, updateItemFields,
  listItemNotes, addItemNote, createBoardItem, bulkUpdateBoardStatus, bulkAssign, bulkDeleteItems,
  type NewItemDraft,
} from './api';
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
  estimatedHours: 'estimated_hours',
  customerName: 'customer_name',
  module: 'module',
  tags: 'tags',
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
  // Record<keyof BoardItem, unknown>, not Partial<BoardItem> — callers need
  // to pass an explicit null to clear a field back to empty (e.g. blurring
  // an emptied input), and Partial<BoardItem>'s non-nullable optional props
  // would reject that even though it's exactly what an UPDATE needs to
  // distinguish "clear this" from "don't touch this" (an omitted key).
  return async (id: string, fields: Partial<Record<keyof BoardItem, unknown>>): Promise<void> => {
    if (isSupabaseConfigured) {
      const dbFields: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) dbFields[COLMAP[k] ?? k] = v;
      await updateItemFields(id, dbFields);
      await qc.invalidateQueries({ queryKey: ['board'] });
      return;
    }
    patch(id, fields as Partial<BoardItem>);
  };
}

/** Backlog multi-select actions — one round trip per action in real mode
 * (an .in('id', ids) update/delete), a loop over the mock store otherwise. */
export function useBulkActions() {
  const qc = useQueryClient();
  const mockMove = useBoardStore((s) => s.moveItem);
  const mockDelete = useBoardStore((s) => s.deleteItems);
  const mockAssign = useBoardStore((s) => s.bulkAssign);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['board'] });

  return {
    async complete(ids: string[]): Promise<void> {
      if (isSupabaseConfigured) {
        await bulkUpdateBoardStatus(ids, 'released');
        await invalidate();
        return;
      }
      ids.forEach((id) => mockMove(id, 'released'));
    },
    async remove(ids: string[]): Promise<void> {
      if (isSupabaseConfigured) {
        await bulkDeleteItems(ids);
        await invalidate();
        return;
      }
      mockDelete(ids);
    },
    async assign(ids: string[], assignee: { id: string; name: string; initials: string } | null): Promise<void> {
      if (isSupabaseConfigured) {
        await bulkAssign(ids, assignee?.id ?? null);
        await invalidate();
        return;
      }
      mockAssign(ids, assignee ? { name: assignee.name, initials: assignee.initials } : null);
    },
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

export function useCreateItem() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const mockAdd = useBoardStore((s) => s.addManualItem);
  return async (draft: NewItemDraft): Promise<void> => {
    if (isSupabaseConfigured) {
      if (!user) throw new Error('Not authenticated');
      await createBoardItem(draft, user.workspaceId);
      await qc.invalidateQueries({ queryKey: ['board'] });
      return;
    }
    mockAdd(draft);
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
