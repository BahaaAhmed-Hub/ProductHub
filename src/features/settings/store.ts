import { create } from 'zustand';

export type SettingsTab = 'billing' | 'team' | 'integrations';

interface SettingsModalState {
  open: boolean;
  tab: SettingsTab;
  openModal: (tab?: SettingsTab) => void;
  close: () => void;
}

/** Global (not per-route) modal state — Billing/Team/Integrations moved out
 * of the sidebar into a popup reachable from both the Sidebar footer and
 * the TopNav profile menu, so it lives above any single screen. */
export const useSettingsModalStore = create<SettingsModalState>((set) => ({
  open: false,
  tab: 'billing',
  openModal: (tab = 'billing') => set({ open: true, tab }),
  close: () => set({ open: false }),
}));
