import type { Priority, RequestType } from '@/types/domain';

/** Customer-facing request status (friendly labels distinct from internal board states). */
export type CustomerStatus = 'received' | 'in_progress' | 'resolved';

export interface RequestAttachment {
  name: string;
  size: string; // display, e.g. "248 KB"
}

export interface ConversationEntry {
  authorId: string;
  authorName: string;
  isTeam: boolean;
  initials: string;
  timeAgo: string;
  body: string;
  attachment?: RequestAttachment;
}

export interface CustomerRequest {
  id: string;
  ref: string;
  type: RequestType;
  subject: string;
  description: string;
  priority: Priority;
  product: string;
  status: CustomerStatus;
  plannedRelease?: string; // e.g. "Release 4.3 · Aug"
  submittedByName: string;
  submittedOn: string; // "Jun 24"
  createdAt?: string; // ISO, for SLA computation
  updatedAgo: string; // "1d ago"
  slaLeft?: string; // "4h 12m left"
  attachments: RequestAttachment[];
  conversation: ConversationEntry[];
}

export interface RequestDraft {
  type: RequestType;
  subject: string;
  description: string;
  priority: Priority;
  product: string;
  attachments: RequestAttachment[];
}
