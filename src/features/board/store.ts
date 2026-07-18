import { create } from 'zustand';
import type { BoardStatus } from '@/types/domain';
import type { BoardItem, ItemNote, TriageRequest } from './types';
import type { NewItemDraft } from './api';
import { MOCK_BOARD_ITEMS, MOCK_TRIAGE_REQUESTS, MOCK_NOTES } from './mockData';

/** Mock-mode board/triage state so the developer flow is walkable without Supabase. */
interface BoardState {
  items: BoardItem[];
  triage: TriageRequest[];
  notes: Record<string, ItemNote[]>;
  moveItem: (id: string, status: BoardStatus) => void;
  addToBoard: (t: TriageRequest) => void;
  addManualItem: (draft: NewItemDraft) => void;
  setRice: (id: string, score: number) => void;
  patch: (id: string, fields: Partial<BoardItem>) => void;
  addNote: (itemId: string, note: ItemNote) => void;
  deleteItems: (ids: string[]) => void;
  bulkAssign: (ids: string[], assignee: { id: string; name: string; initials: string } | null) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  items: MOCK_BOARD_ITEMS,
  triage: MOCK_TRIAGE_REQUESTS,
  notes: MOCK_NOTES,
  moveItem: (id, status) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, boardStatus: status } : i)) })),
  addToBoard: (t) =>
    set((s) => ({
      triage: s.triage.filter((r) => r.id !== t.id),
      items: [
        { id: `b-${t.id}`, ref: t.ref, title: t.subject, type: t.type, boardStatus: 'triaged', priority: t.priority, planBucket: 'backlog' },
        ...s.items,
      ],
    })),
  addManualItem: (draft) =>
    set((s) => {
      const prefix = draft.type === 'bug' ? 'BUG' : draft.type === 'feature' ? 'FEAT' : 'TASK';
      const ref = `${prefix}-${String(1000 + s.items.length).padStart(4, '0')}`;
      return {
        items: [
          {
            id: `manual-${Date.now()}`,
            ref,
            title: draft.title,
            type: draft.type,
            boardStatus: 'triaged' as BoardStatus,
            priority: draft.priority,
            planBucket: 'backlog',
            ...(draft.swimlane ? { swimlane: draft.swimlane } : {}),
          },
          ...s.items,
        ],
      };
    }),
  setRice: (id, score) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, riceScore: score } : i)) })),
  patch: (id, fields) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...fields } : i)) })),
  addNote: (itemId, note) =>
    set((s) => ({ notes: { ...s.notes, [itemId]: [...(s.notes[itemId] ?? []), note] } })),
  deleteItems: (ids) =>
    set((s) => {
      const drop = new Set(ids);
      return { items: s.items.filter((i) => !drop.has(i.id)) };
    }),
  bulkAssign: (ids, assignee) =>
    set((s) => {
      const pick = new Set(ids);
      return {
        items: s.items.map((i) =>
          pick.has(i.id)
            ? { ...i, assigneeId: assignee?.id, assigneeName: assignee?.name, assigneeInitials: assignee?.initials }
            : i,
        ),
      };
    }),
}));
