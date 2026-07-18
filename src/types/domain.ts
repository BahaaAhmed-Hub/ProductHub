/**
 * Core domain entities for ProductHub.
 * Mirrors the Supabase schema (supabase/migrations). Multi-vendor SaaS:
 *   org → workspace → users, with one shared backlog surfaced per role.
 */

export type Role = 'customer' | 'developer' | 'pm' | 'manager' | 'stakeholder';

export type RequestType = 'bug' | 'feature' | 'query' | 'request';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type RequestStatus =
  | 'submitted'
  | 'triaged'
  | 'in_development'
  | 'in_qa'
  | 'released'
  | 'closed';

export type BoardStatus = 'triaged' | 'in_development' | 'in_qa' | 'released';

export interface Org {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
}

export interface Workspace {
  id: string;
  orgId: string;
  name: string; // e.g. "Orion Cloud"
  createdAt: string;
}

export interface User {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: Role;
  status?: 'active' | 'pending';
  requestedRole?: Role;
  avatarUrl?: string;
  initials: string;
}

export interface SupportRequest {
  id: string;
  workspaceId: string;
  ref: string; // e.g. BUG-0042
  type: RequestType;
  subject: string;
  description: string;
  priority: Priority;
  product: string;
  status: RequestStatus;
  slaDueAt?: string;
  firstResponseAt?: string;
  submittedBy: string;
  createdAt: string;
}

export interface BacklogItem {
  id: string;
  workspaceId: string;
  ref: string;
  title: string;
  description?: string;
  sourceRequestId?: string;
  type: RequestType;
  boardStatus: BoardStatus;
  priority: Priority;
  assigneeId?: string;
  sprintId?: string;
  releaseId?: string;
  swimlaneId?: string;
  planBucket?: 'backlog' | 'planned' | 'in_cycle';
  riceScore?: number;
  createdAt: string;
}

export interface ItemNote {
  id: string;
  itemId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface Sprint {
  id: string;
  workspaceId: string;
  name: string; // "Sprint 24"
  startsAt: string;
  endsAt: string;
  goal?: string;
}

export interface Release {
  id: string;
  workspaceId: string;
  name: string; // "Release 4.3"
  targetDate?: string;
  status: 'planned' | 'on_track' | 'at_risk' | 'released';
}

export interface RoadmapItem {
  id: string;
  workspaceId: string;
  title: string;
  theme?: string;
  bucket: 'now' | 'next' | 'later';
  isPublished: boolean;
}

export interface AppNotification {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body?: string;
  readAt?: string;
  createdAt: string;
}
