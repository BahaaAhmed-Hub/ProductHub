import { create } from 'zustand';
import type { BoardStatus } from '@/types/domain';
import type { BoardItem, ItemNote, TriageRequest } from './types';
import { MOCK_BOARD_ITEMS, MOCK_TRIAGE_REQUESTS, MOCK_NOTES } from './mockData';

/** Mock-mode board/triage state so the developer flow is walkable without Supabase. */
interface BoardState {
  items: BoardItem[];
  triage: TriageRequest[];
  notes: Record<string, ItemNote[]>;
  moveItem: (id: string, status: BoardStatus) => void;
  addToBoard: (t: TriageRequest) => void;
  setRice: (id: string, score: number) => void;
  patch: (id: string, fields: Partial<BoardItem>) => void;
  addNote: (itemId: string, note: ItemNote) => void;
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
  setRice: (id, score) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, riceScore: score } : i)) })),
  patch: (id, fields) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...fields } : i)) })),
  addNote: (itemId, note) =>
    set((s) => ({ notes: { ...s.notes, [itemId]: [...(s.notes[itemId] ?? []), note] } })),
}));
