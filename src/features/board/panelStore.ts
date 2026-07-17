import { create } from 'zustand';

/** Global slide-over state for item detail — Asana-style right panel that
 * overlays the current screen instead of navigating away from it. */
interface PanelState {
  openItemId: string | null;
  open: (id: string) => void;
  close: () => void;
}

export const useItemPanel = create<PanelState>((set) => ({
  openItemId: null,
  open: (id) => set({ openItemId: id }),
  close: () => set({ openItemId: null }),
}));
