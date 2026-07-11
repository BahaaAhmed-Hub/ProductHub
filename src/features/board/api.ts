import { supabase } from '@/lib/supabase';
import type { BoardStatus, Priority, RequestType } from '@/types/domain';
import type { BoardItem, TriageRequest } from './types';

function initials(name?: string | null): string | undefined {
  if (!name) return undefined;
  return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

interface ItemRow {
  id: string;
  ref: string;
  title: string;
  type: RequestType;
  board_status: BoardStatus;
  priority: Priority;
  source_request_id: string | null;
  assignee: { name: string } | null;
}

export async function listBoardItems(): Promise<BoardItem[]> {
  const { data, error } = await supabase
    .from('backlog_items')
    .select('id, ref, title, type, board_status, priority, source_request_id, assignee:profiles!backlog_items_assignee_id_fkey(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as ItemRow[]).map((r) => ({
    id: r.id,
    ref: r.ref,
    title: r.title,
    type: r.type,
    boardStatus: r.board_status,
    priority: r.priority,
    assigneeName: r.assignee?.name,
    assigneeInitials: initials(r.assignee?.name),
    ...(r.source_request_id ? { sourceRequestId: r.source_request_id } : {}),
  }));
}

export async function updateBoardStatus(id: string, status: BoardStatus): Promise<void> {
  const { error } = await supabase.from('backlog_items').update({ board_status: status }).eq('id', id);
  if (error) throw error;
}

interface TriageRow {
  id: string;
  ref: string;
  type: RequestType;
  subject: string;
  description: string;
  priority: Priority;
  product: string | null;
  created_at: string;
  submitted_by: { name: string } | null;
}

export async function listTriageRequests(): Promise<TriageRequest[]> {
  const { data, error } = await supabase
    .from('requests')
    .select('id, ref, type, subject, description, priority, product, created_at, submitted_by:profiles(name)')
    .eq('status', 'submitted')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as TriageRow[]).map((r) => ({
    id: r.id,
    ref: r.ref,
    type: r.type,
    subject: r.subject,
    description: r.description,
    priority: r.priority,
    product: r.product ?? '',
    customer: r.submitted_by?.name ?? 'Customer',
    createdAgo: relAgo(r.created_at),
  }));
}

function relAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export async function addRequestToBoard(
  t: TriageRequest,
  workspaceId: string,
): Promise<void> {
  const { error: insErr } = await supabase.from('backlog_items').insert({
    workspace_id: workspaceId,
    ref: t.ref,
    title: t.subject,
    description: t.description,
    source_request_id: t.id,
    type: t.type,
    board_status: 'triaged',
    priority: t.priority,
  });
  if (insErr) throw insErr;
  const { error: updErr } = await supabase.from('requests').update({ status: 'triaged' }).eq('id', t.id);
  if (updErr) throw updErr;
}
