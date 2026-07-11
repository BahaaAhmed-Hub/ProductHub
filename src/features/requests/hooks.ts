import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { useRequestsStore } from './store';
import { archiveRequests, createRequest, getRequest, listRequests } from './api';
import type { CustomerRequest, RequestDraft } from './types';

/**
 * Data hooks that transparently use Supabase when configured, and fall back to
 * the in-memory mock store otherwise. Screens depend only on these hooks, so
 * flipping between mock and real mode requires no screen changes.
 */

export function useRequests(): { requests: CustomerRequest[]; isLoading: boolean } {
  const mock = useRequestsStore((s) => s.requests);
  const q = useQuery({
    queryKey: ['requests'],
    queryFn: listRequests,
    enabled: isSupabaseConfigured,
  });
  if (isSupabaseConfigured) return { requests: q.data ?? [], isLoading: q.isLoading };
  return { requests: mock, isLoading: false };
}

export function useRequest(id: string | undefined): CustomerRequest | null {
  const mock = useRequestsStore((s) => (id ? s.requests.find((r) => r.id === id) : undefined));
  const q = useQuery({
    queryKey: ['request', id],
    queryFn: () => getRequest(id as string),
    enabled: isSupabaseConfigured && !!id,
  });
  if (isSupabaseConfigured) return q.data ?? null;
  return mock ?? null;
}

export function useCreateRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const addMock = useRequestsStore((s) => s.addRequest);
  return async (draft: RequestDraft): Promise<CustomerRequest> => {
    if (isSupabaseConfigured) {
      if (!user) throw new Error('Not authenticated');
      const created = await createRequest(draft, {
        workspaceId: user.workspaceId,
        profileId: user.id,
      });
      await qc.invalidateQueries({ queryKey: ['requests'] });
      return created;
    }
    return addMock(draft);
  };
}

export function useArchiveRequests() {
  const qc = useQueryClient();
  const archiveMock = useRequestsStore((s) => s.archiveSelected);
  return async (ids: string[]): Promise<void> => {
    if (isSupabaseConfigured) {
      await archiveRequests(ids);
      await qc.invalidateQueries({ queryKey: ['requests'] });
      return;
    }
    archiveMock();
  };
}
