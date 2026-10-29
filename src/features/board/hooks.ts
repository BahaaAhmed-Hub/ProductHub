import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { invoke } from '@/lib/edgeFunctions';
import { useAsanaConnection, pushToAsana } from '@/features/integrations/asana';
import type { BoardStatus } from '@/types/domain';
import { useBoardStore } from './store';
import {
  addRequestToBoard, listBoardItems, listTriageRequests, updateBoardStatus, updateRiceScore, updateItemFields,
  listItemNotes, addItemNote, createBoardItem, bulkUpdateBoardStatus, bulkAssign, bulkDeleteItems, bulkSetArchived, bulkSetModule, clearDirty,
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
  createdAt: 'created_at',
  lockedFields: 'locked_fields',
  archivedAt: 'archived_at',
};

/** Archived items are hidden everywhere except where a caller asks for them (the Backlog's archive view). */
export function useBoardItems(opts: { includeArchived?: boolean } = {}): { items: BoardItem[]; isLoading: boolean } {
  const mock = useBoardStore((s) => s.items);
  const q = useQuery({ queryKey: ['board'], queryFn: listBoardItems, enabled: isSupabaseConfigured });
  const all = isSupabaseConfigured ? (q.data ?? []) : mock;
  const items = opts.includeArchived ? all : all.filter((i) => !i.archivedAt);
  return { items, isLoading: isSupabaseConfigured ? q.isLoading : false };
}

/** Fields whose local edits are written back to Asana (see asana-push). */
const PUSH_KEYS = new Set(['type', 'priority', 'boardStatus', 'module', 'customerName', 'estimatedHours', 'title']);

/** Returns a function that, when "automatically sync changes to Asana" is on,
 * pushes the given synced items in the background. Failures land in the sync
 * log (the function records every attempt), so they're not thrown here. */
export function useAutoPush() {
  const qc = useQueryClient();
  const { connection } = useAsanaConnection();
  return (ids: string[]): void => {
    if (!isSupabaseConfigured || !connection.autoPush) return;
    const known = qc.getQueryData<BoardItem[]>(['board']) ?? [];
    const synced = ids.filter((id) => known.find((i) => i.id === id)?.externalSource === 'asana');
    if (synced.length > 0) void pushToAsana(synced).catch(() => undefined);
  };
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
  const autoPush = useAutoPush();
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
      if (Object.keys(fields).some((k) => PUSH_KEYS.has(k))) autoPush([id]);
      return;
    }
    patch(id, fields as Partial<BoardItem>);
  };
}

type AsanaAction = 'complete' | 'reopen' | 'archive' | 'unarchive' | 'delete';

/** Backlog multi-select actions — one round trip per action in real mode
 * (an .in('id', ids) update/delete), a loop over the mock store otherwise.
 * complete/reopen/archive/restore also write through to Asana for synced
 * items (asana-action Edge Function) before changing anything locally: an
 * item whose Asana update fails is left untouched here too, so the two
 * sides never disagree. */
export function useBulkActions() {
  const qc = useQueryClient();
  const autoPush = useAutoPush();
  const mockMove = useBoardStore((s) => s.moveItem);
  const mockDelete = useBoardStore((s) => s.deleteItems);
  const mockAssign = useBoardStore((s) => s.bulkAssign);
  const mockPatch = useBoardStore((s) => s.patch);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['board'] });

  /** Returns the ids that may be changed locally; throws after the local
   * change is applied (by the caller) if some Asana updates failed. */
  async function writeToAsana(action: AsanaAction, ids: string[]): Promise<{ okIds: string[]; failure?: string }> {
    const known = qc.getQueryData<BoardItem[]>(['board']) ?? [];
    const synced = ids.some((id) => known.find((i) => i.id === id)?.externalSource === 'asana');
    if (!synced) return { okIds: ids };
    const res = await invoke<{ results: { id: string; status: 'ok' | 'skipped' | 'error'; error?: string }[]; note?: string }>(
      'asana-action',
      { action, itemIds: ids },
    );
    const failed = res.results.filter((r) => r.status === 'error');
    const failedIds = new Set(failed.map((r) => r.id));
    return {
      okIds: ids.filter((id) => !failedIds.has(id)),
      ...(failed.length > 0
        ? { failure: `${failed.length} task${failed.length === 1 ? '' : 's'} could not be updated in Asana (${failed[0]?.error ?? 'unknown error'}) and were left unchanged.` }
        : res.note
          ? { failure: res.note }
          : {}),
    };
  }

  async function viaAsana(action: AsanaAction, ids: string[], applyReal: (okIds: string[]) => Promise<void>, applyMock: (id: string) => void) {
    if (isSupabaseConfigured) {
      const { okIds, failure } = await writeToAsana(action, ids);
      if (okIds.length > 0) await applyReal(okIds);
      await invalidate();
      if (failure) throw new Error(failure);
      return;
    }
    ids.forEach(applyMock);
  }

  return {
    complete: (ids: string[]) =>
      viaAsana('complete', ids, async (ok) => { await bulkUpdateBoardStatus(ok, 'released'); await clearDirty(ok); }, (id) => mockMove(id, 'released')),
    reopen: (ids: string[]) =>
      viaAsana('reopen', ids, async (ok) => { await bulkUpdateBoardStatus(ok, 'triaged'); await clearDirty(ok); }, (id) => mockMove(id, 'triaged')),
    archive: (ids: string[]) =>
      viaAsana('archive', ids, (ok) => bulkSetArchived(ok, true), (id) => mockPatch(id, { archivedAt: new Date().toISOString() })),
    restore: (ids: string[]) =>
      viaAsana('unarchive', ids, (ok) => bulkSetArchived(ok, false), (id) => mockPatch(id, { archivedAt: undefined })),
    /** Move tasks to another module (null = none) and, with auto-sync on, push the change to Asana. */
    async setModule(ids: string[], module: string | null): Promise<void> {
      if (isSupabaseConfigured) {
        await bulkSetModule(ids, module);
        await invalidate();
        autoPush(ids);
        return;
      }
      ids.forEach((id) => mockPatch(id, module ? { module } : { module: undefined }));
    },
    /** Delete tasks here; `alsoAsana` deletes the synced ones in Asana first (any Asana failure aborts that task's deletion). */
    async remove(ids: string[], opts: { alsoAsana?: boolean } = {}): Promise<void> {
      if (isSupabaseConfigured) {
        let okIds = ids;
        let failure: string | undefined;
        if (opts.alsoAsana) ({ okIds, failure } = await writeToAsana('delete', ids));
        if (okIds.length > 0) await bulkDeleteItems(okIds);
        await invalidate();
        if (failure) throw new Error(failure);
        return;
      }
      mockDelete(ids);
    },
    async assign(
      ids: string[],
      assignee: { id: string; name: string; initials: string; profileId?: string | null } | null,
    ): Promise<void> {
      if (isSupabaseConfigured) {
        await bulkAssign(ids, assignee?.id ?? null, assignee?.profileId ?? null);
        await invalidate();
        autoPush(ids);
        return;
      }
      mockAssign(ids, assignee);
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
