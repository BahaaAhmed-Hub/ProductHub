import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';

export type WidgetKind = 'by_type' | 'by_status' | 'by_priority' | 'sla_breaches' | 'recent_activity' | 'team_workload' | 'rice_top';

export interface ReportWidget {
  id: string;
  kind: WidgetKind;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const WIDGET_LIBRARY: { kind: WidgetKind; label: string; defaultTitle: string }[] = [
  { kind: 'by_type', label: 'Backlog by type', defaultTitle: 'Backlog by type' },
  { kind: 'by_status', label: 'Backlog by status', defaultTitle: 'Backlog by status' },
  { kind: 'by_priority', label: 'Backlog by priority', defaultTitle: 'Backlog by priority' },
  { kind: 'sla_breaches', label: 'SLA breaches', defaultTitle: 'SLA breaches' },
  { kind: 'recent_activity', label: 'Recently created', defaultTitle: 'Recently created' },
  { kind: 'team_workload', label: 'Team workload', defaultTitle: 'Team workload' },
  { kind: 'rice_top', label: 'Top RICE items', defaultTitle: 'Top RICE items' },
];

const DEFAULT_WIDGETS: ReportWidget[] = [
  { id: 'default-type', kind: 'by_type', title: 'Backlog by type', x: 0, y: 0, w: 4, h: 4 },
  { id: 'default-status', kind: 'by_status', title: 'Backlog by status', x: 4, y: 0, w: 4, h: 4 },
  { id: 'default-priority', kind: 'by_priority', title: 'Backlog by priority', x: 8, y: 0, w: 4, h: 4 },
];

export function useReportWidgets(): { widgets: ReportWidget[]; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['report-widgets'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<ReportWidget[]> => {
      const { data, error } = await supabase.from('report_widgets').select('id, kind, title, x, y, w, h').order('created_at');
      if (error) throw error;
      return data as ReportWidget[];
    },
  });
  if (!isSupabaseConfigured) return { widgets: DEFAULT_WIDGETS, isLoading: false };
  return { widgets: q.data ?? [], isLoading: q.isLoading };
}

export function useReportWidgetActions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['report-widgets'] });

  return {
    async add(kind: WidgetKind, title: string, placement: { x: number; y: number; w: number; h: number }): Promise<void> {
      if (!isSupabaseConfigured) throw new Error('Adding widgets requires a configured Supabase project.');
      if (!user) throw new Error('Not signed in.');
      const { error } = await supabase.from('report_widgets').insert({
        workspace_id: user.workspaceId,
        kind,
        title,
        ...placement,
      });
      if (error) throw error;
      await invalidate();
    },
    async rename(id: string, title: string): Promise<void> {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.from('report_widgets').update({ title }).eq('id', id);
      if (error) throw error;
      await invalidate();
    },
    async remove(id: string): Promise<void> {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.from('report_widgets').delete().eq('id', id);
      if (error) throw error;
      await invalidate();
    },
    /** One row per changed widget — react-grid-layout hands back the full
     * layout on every drag/resize stop, not a diff, so callers should only
     * pass the ones that actually moved. */
    async saveLayout(items: { id: string; x: number; y: number; w: number; h: number }[]): Promise<void> {
      if (!isSupabaseConfigured) return; // mock mode: dragging still works locally, just doesn't persist
      await Promise.all(
        items.map((it) => supabase.from('report_widgets').update({ x: it.x, y: it.y, w: it.w, h: it.h }).eq('id', it.id)),
      );
      await invalidate();
    },
  };
}
