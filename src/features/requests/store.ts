import { create } from 'zustand';
import type { CustomerRequest, RequestDraft } from './types';
import { MOCK_REQUESTS } from './mockData';

let counter = 43; // next BUG/FEAT/QRY number for mock refs

const refPrefix: Record<RequestDraft['type'], string> = {
  bug: 'BUG',
  feature: 'FEAT',
  query: 'QRY',
};

interface RequestsState {
  requests: CustomerRequest[];
  selected: Set<string>;
  /** create a request from a draft, return the new ref for the confirmation screen */
  addRequest: (draft: RequestDraft) => CustomerRequest;
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
  archiveSelected: () => void;
}

export const useRequestsStore = create<RequestsState>((set, get) => ({
  requests: MOCK_REQUESTS,
  selected: new Set<string>(),

  addRequest(draft) {
    const num = String(counter++).padStart(4, '0');
    const created: CustomerRequest = {
      id: `r-${num}`,
      ref: `${refPrefix[draft.type]}-${num}`,
      type: draft.type,
      subject: draft.subject,
      description: draft.description,
      priority: draft.priority,
      product: draft.product,
      status: 'received',
      submittedByName: 'Maya T.',
      submittedOn: 'Today',
      updatedAgo: 'just now',
      attachments: draft.attachments,
      conversation: [
        {
          authorId: 'u-cust',
          authorName: 'You',
          isTeam: false,
          initials: 'MT',
          timeAgo: 'just now',
          body: draft.description,
          ...(draft.attachments[0] ? { attachment: draft.attachments[0] } : {}),
        },
      ],
    };
    set({ requests: [created, ...get().requests] });
    return created;
  },

  toggleSelected(id) {
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selected: next };
    });
  },

  clearSelected: () => set({ selected: new Set() }),

  archiveSelected() {
    set((s) => ({
      requests: s.requests.filter((r) => !s.selected.has(r.id)),
      selected: new Set(),
    }));
  },
}));
