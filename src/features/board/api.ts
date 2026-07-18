import { supabase } from '@/lib/supabase';
import type { BoardStatus, Priority, RequestType } from '@/types/domain';
import type { BoardItem, ItemNote, TriageRequest } from './types';

function initials(name?: string | null): string | undefined {
  if (!name) return undefined;
  return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}
function initialsReq(name: string): string {
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
  rice_score: number | null;
  wsjf_score: number | null;
  effort: number | null;
  score_inputs: Record<string, unknown> | null;
  swimlane: string | null;
  release_id: string | null;
  plan_bucket: string | null;
  created_at: string | null;
  assignee: { name: string } | null;
  external_assignee_name: string | null;
  custom_fields: Record<string, string> | null;
  estimated_hours: number | null;
  customer_name: string | null;
  module: string | null;
  tags: string[] | null;
}

const ITEM_SELECT =
  'id, ref, title, type, board_status, priority, source_request_id, rice_score, wsjf_score, effort, score_inputs, swimlane, release_id, plan_bucket, created_at, external_assignee_name, custom_fields, estimated_hours, customer_name, module, tags, assignee:profiles!backlog_items_assignee_id_fkey(name)';

export async function listBoardItems(): Promise<BoardItem[]> {
  const [{ data, error }, { data: defs, error: defsError }] = await Promise.all([
    supabase.from('backlog_items').select(ITEM_SELECT).order('created_at', { ascending: false }),
    supabase.from('custom_field_defs').select('id, name'),
  ]);
  if (error) throw error;
  if (defsError) throw defsError;
  const nameById = new Map((defs as { id: string; name: string }[]).map((d) => [d.id, d.name]));
  return (data as unknown as ItemRow[]).map((r) => ({
    id: r.id,
    ref: r.ref,
    title: r.title,
    type: r.type,
    boardStatus: r.board_status,
    priority: r.priority,
    // Falls back to the Asana assignee's name when no workspace member's
    // email matched — keeps the owner visible instead of silently dropping
    // it, even though there's no local profile to link to.
    assigneeName: r.assignee?.name ?? r.external_assignee_name ?? undefined,
    assigneeInitials: initials(r.assignee?.name ?? r.external_assignee_name),
    ...(r.source_request_id ? { sourceRequestId: r.source_request_id } : {}),
    ...(r.rice_score != null ? { riceScore: Number(r.rice_score) } : {}),
    ...(r.wsjf_score != null ? { wsjfScore: Number(r.wsjf_score) } : {}),
    ...(r.effort != null ? { effort: Number(r.effort) } : {}),
    ...(r.score_inputs ? { scoreInputs: r.score_inputs } : {}),
    ...(r.swimlane ? { swimlane: r.swimlane } : {}),
    ...(r.release_id ? { releaseId: r.release_id } : {}),
    ...(r.created_at ? { createdAt: r.created_at } : {}),
    ...(r.plan_bucket ? { planBucket: r.plan_bucket } : {}),
    ...(r.custom_fields && Object.keys(r.custom_fields).length > 0
      ? {
          customFields: Object.entries(r.custom_fields)
            .map(([defId, value]) => ({ name: nameById.get(defId), value }))
            .filter((f): f is { name: string; value: string } => Boolean(f.name)),
        }
      : {}),
    ...(r.estimated_hours != null ? { estimatedHours: Number(r.estimated_hours) } : {}),
    ...(r.customer_name ? { customerName: r.customer_name } : {}),
    ...(r.module ? { module: r.module } : {}),
    ...(r.tags && r.tags.length > 0 ? { tags: r.tags } : {}),
  }));
}

// ---------- item notes (activity) ----------
interface NoteRow {
  id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  author: { name: string } | null;
}

export async function listItemNotes(itemId: string): Promise<ItemNote[]> {
  const { data, error } = await supabase
    .from('item_notes')
    .select('id, body, is_internal, created_at, author:profiles!item_notes_author_id_fkey(name)')
    .eq('item_id', itemId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as unknown as NoteRow[]).map((n) => ({
    id: n.id,
    author: n.author?.name ?? 'Member',
    initials: initialsReq(n.author?.name ?? 'M'),
    ago: relAgo(n.created_at),
    body: n.body,
    internal: n.is_internal,
  }));
}

export async function addItemNote(
  itemId: string,
  body: string,
  isInternal: boolean,
  authorId: string,
): Promise<void> {
  const { error } = await supabase
    .from('item_notes')
    .insert({ item_id: itemId, body, is_internal: isInternal, author_id: authorId });
  if (error) throw error;
}

export async function updateItemFields(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('backlog_items').update(fields).eq('id', id);
  if (error) throw error;
}

export async function updateBoardStatus(id: string, status: BoardStatus): Promise<void> {
  const { error } = await supabase.from('backlog_items').update({ board_status: status }).eq('id', id);
  if (error) throw error;
}

export async function updateRiceScore(id: string, score: number): Promise<void> {
  const { error } = await supabase.from('backlog_items').update({ rice_score: score }).eq('id', id);
  if (error) throw error;
}

// ---------- bulk actions (Backlog multi-select) ----------
export async function bulkUpdateBoardStatus(ids: string[], status: BoardStatus): Promise<void> {
  const { error } = await supabase.from('backlog_items').update({ board_status: status }).in('id', ids);
  if (error) throw error;
}

export async function bulkAssign(ids: string[], assigneeId: string | null): Promise<void> {
  const { error } = await supabase.from('backlog_items').update({ assignee_id: assigneeId }).in('id', ids);
  if (error) throw error;
}

export async function bulkDeleteItems(ids: string[]): Promise<void> {
  const { error } = await supabase.from('backlog_items').delete().in('id', ids);
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

const ITEM_PREFIX: Record<RequestType, string> = { bug: 'BUG', feature: 'FEAT', query: 'TASK', request: 'REQ' };

export interface NewItemDraft {
  title: string;
  type: RequestType;
  priority: Priority;
  swimlane?: string;
}

/** Directly create a backlog item (PM/Manager/Developer authoring a task,
 * with no originating customer request). */
export async function createBoardItem(
  draft: NewItemDraft,
  workspaceId: string,
): Promise<BoardItem> {
  const ref = `${ITEM_PREFIX[draft.type]}-${String(Math.floor(Math.abs(Date.now()) % 10000)).padStart(4, '0')}`;
  const { data, error } = await supabase
    .from('backlog_items')
    .insert({
      workspace_id: workspaceId,
      ref,
      title: draft.title,
      type: draft.type,
      priority: draft.priority,
      board_status: 'triaged',
      plan_bucket: 'backlog',
      ...(draft.swimlane ? { swimlane: draft.swimlane } : {}),
    })
    .select(ITEM_SELECT)
    .single();
  if (error) throw error;
  const r = data as unknown as ItemRow;
  return {
    id: r.id, ref: r.ref, title: r.title, type: r.type, boardStatus: r.board_status, priority: r.priority,
    ...(r.plan_bucket ? { planBucket: r.plan_bucket } : {}),
  };
}
