import { supabase } from '@/lib/supabase';
import type { CustomerRequest, RequestDraft } from './types';
import type { CustomerStatus } from './types';
import type { Priority, RequestType } from '@/types/domain';

/** DB request row shape (subset we read). */
interface RequestRow {
  id: string;
  ref: string;
  type: RequestType;
  subject: string;
  description: string;
  priority: Priority;
  product: string | null;
  status: string;
  sla_due_at: string | null;
  created_at: string;
  submitted_by: { name: string } | null;
}

function toCustomerStatus(s: string): CustomerStatus {
  switch (s) {
    case 'submitted':
      return 'received';
    case 'released':
    case 'closed':
      return 'resolved';
    default:
      return 'in_progress'; // triaged / in_development / in_qa
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < 3_600_000) return 'just now';
  if (diff < day) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}

function mapRow(r: RequestRow): CustomerRequest {
  return {
    id: r.id,
    ref: r.ref,
    type: r.type,
    subject: r.subject,
    description: r.description,
    priority: r.priority,
    product: r.product ?? '',
    status: toCustomerStatus(r.status),
    submittedByName: r.submitted_by?.name ?? 'You',
    submittedOn: fmtDate(r.created_at),
    createdAt: r.created_at,
    updatedAgo: ago(r.created_at),
    attachments: [],
    conversation: [],
  };
}

const SELECT = '*, submitted_by:profiles(name)';

export async function listRequests(): Promise<CustomerRequest[]> {
  const { data, error } = await supabase
    .from('requests')
    .select(SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as RequestRow[]).map(mapRow);
}

export async function getRequest(id: string): Promise<CustomerRequest | null> {
  const { data, error } = await supabase.from('requests').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as unknown as RequestRow) : null;
}

const prefix: Record<RequestType, string> = { bug: 'BUG', feature: 'FEAT', query: 'QRY' };

export async function createRequest(
  draft: RequestDraft,
  ctx: { workspaceId: string; profileId: string },
): Promise<CustomerRequest> {
  const ref = `${prefix[draft.type]}-${String(Math.floor(Math.abs(Date.now()) % 10000)).padStart(4, '0')}`;
  const { data, error } = await supabase
    .from('requests')
    .insert({
      workspace_id: ctx.workspaceId,
      ref,
      type: draft.type,
      subject: draft.subject,
      description: draft.description,
      priority: draft.priority,
      product: draft.product,
      status: 'submitted',
      submitted_by: ctx.profileId,
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return mapRow(data as unknown as RequestRow);
}

export async function archiveRequests(ids: string[]): Promise<void> {
  const { error } = await supabase.from('requests').delete().in('id', ids);
  if (error) throw error;
}
