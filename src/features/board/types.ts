import type { BoardStatus, Priority, RequestType } from '@/types/domain';

export interface BoardItem {
  id: string;
  ref: string;
  title: string;
  type: RequestType;
  boardStatus: BoardStatus;
  priority: Priority;
  assigneeName?: string;
  assigneeInitials?: string;
  sourceRequestId?: string;
  riceScore?: number;
  wsjfScore?: number;
  effort?: number;
  scoreInputs?: Record<string, unknown>;
  swimlane?: string;
  releaseId?: string;
  createdAt?: string;
  planBucket?: string; // backlog | planned | in_cycle
  customFields?: { name: string; value: string }[];
}

export interface ItemNote {
  id: string;
  author: string;
  initials: string;
  ago: string;
  body: string;
  internal: boolean;
}

export interface TriageRequest {
  id: string;
  ref: string;
  type: RequestType;
  subject: string;
  description: string;
  priority: Priority;
  product: string;
  customer: string;
  createdAgo: string;
}

export const BOARD_COLUMNS: { status: BoardStatus; label: string; dot: string }[] = [
  { status: 'triaged', label: 'Triaged', dot: '#888780' },
  { status: 'in_development', label: 'In Development', dot: '#534AB7' },
  { status: 'in_qa', label: 'In QA', dot: '#B8860B' },
  { status: 'released', label: 'Released', dot: '#1D9E75' },
];
