import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import type { BoardStatus } from '@/types/domain';
import { useBoardStore } from './store';
import { addRequestToBoard, listBoardItems, listTriageRequests, updateBoardStatus, updateRiceScore } from './api';
import type { BoardItem, TriageRequest } from './types';

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
