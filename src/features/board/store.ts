import { create } from 'zustand';
import type { BoardStatus } from '@/types/domain';
import type { BoardItem, TriageRequest } from './types';
import { MOCK_BOARD_ITEMS, MOCK_TRIAGE_REQUESTS } from './mockData';

/** Mock-mode board/triage state so the developer flow is walkable without Supabase. */
interface BoardState {
  items: BoardItem[];
  triage: TriageRequest[];
  moveItem: (id: string, status: BoardStatus) => void;
  addToBoard: (t: TriageRequest) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  items: MOCK_BOARD_ITEMS,
  triage: MOCK_TRIAGE_REQUESTS,
  moveItem: (id, status) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, boardStatus: status } : i)) })),
  addToBoard: (t) =>
    set((s) => ({
      triage: s.triage.filter((r) => r.id !== t.id),
      items: [
        { id: `b-${t.id}`, ref: t.ref, title: t.subject, type: t.type, boardStatus: 'triaged', priority: t.priority },
        ...s.items,
      ],
    })),
}));
