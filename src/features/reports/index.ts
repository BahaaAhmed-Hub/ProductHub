import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { invoke } from '@/lib/edgeFunctions';
import type { WidgetSpec } from './customSpec';

export type WidgetKind = 'by_type' | 'by_status' | 'by_priority' | 'sla_breaches' | 'recent_activity' | 'team_workload' | 'rice_top' | 'custom';
export type ChartType = 'bar' | 'pie' | 'list' | 'number';

export interface ReportWidget {
  id: string;
  kind: WidgetKind;
  title: string;
  chartType: ChartType;
  spec?: WidgetSpec;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fixed-kind widgets — only one of each may exist on the dashboard at a
 * time (the "Add widget" menu disables an option once it's on the board).
 * Custom (AI) widgets aren't in this library and have no such limit — each
 * is defined by its own description, so duplicates are just different
 * widgets that happen to look similar. */
export const WIDGET_LIBRARY: { kind: Exclude<WidgetKind, 'custom'>; label: string; defaultTitle: string }[] = [
  { kind: 'by_type', label: 'Backlog by type', defaultTitle: 'Backlog by type' },
  { kind: 'by_status', label: 'Backlog by status', defaultTitle: 'Backlog by status' },
  { kind: 'by_priority', label: 'Backlog by priority', defaultTitle: 'Backlog by priority' },
  { kind: 'sla_breaches', label: 'SLA breaches', defaultTitle: 'SLA breaches' },
  { kind: 'recent_activity', label: 'Recently created', defaultTitle: 'Recently created' },
  { kind: 'team_workload', label: 'Team workload', defaultTitle: 'Team workload' },
  { kind: 'rice_top', label: 'Top RICE items', defaultTitle: 'Top RICE items' },
];

/** Kinds whose data is a {label,n}[] tally — these support switching chart
 * type (bar/pie/list/number). sla_breaches and recent_activity render a
 * fixed stat/feed instead; forcing them into a bar or pie wouldn't mean
 * anything, so they don't get the switcher. */
export const CHART_SWITCHABLE_KINDS: WidgetKind[] = ['by_type', 'by_status', 'by_priority', 'team_workload', 'rice_top', 'custom'];

const DEFAULT_WIDGETS: ReportWidget[] = [
  { id: 'default-type', kind: 'by_type', title: 'Backlog by type', chartType: 'bar', x: 0, y: 0, w: 4, h: 4 },
  { id: 'default-status', kind: 'by_status', title: 'Backlog by status', chartType: 'bar', x: 4, y: 0, w: 4, h: 4 },
  { id: 'default-priority', kind: 'by_priority', title: 'Backlog by priority', chartType: 'pie', x: 8, y: 0, w: 4, h: 4 },
];

interface WidgetRow {
  id: string;
  kind: WidgetKind;
  title: string;
  chart_type: ChartType;
  spec: WidgetSpec | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

function fromRow(r: WidgetRow): ReportWidget {
  return {
    id: r.id, kind: r.kind, title: r.title, chartType: r.chart_type,
    ...(r.spec ? { spec: r.spec } : {}),
    x: r.x, y: r.y, w: r.w, h: r.h,
  };
}

export function useReportWidgets(): { widgets: ReportWidget[]; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['report-widgets'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<ReportWidget[]> => {
      const { data, error } = await supabase
        .from('report_widgets')
        .select('id, kind, title, chart_type, spec, x, y, w, h')
        .order('created_at');
      if (error) throw error;
      return (data as WidgetRow[]).map(fromRow);
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
    async add(
      kind: Exclude<WidgetKind, 'custom'>,
      title: string,
      placement: { x: number; y: number; w: number; h: number },
    ): Promise<void> {
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
    /** Describe-in-English widget: asks the widget-spec Edge Function to
     * turn the description into a {groupBy,metric,filter} spec (and a
     * title), then saves a kind='custom' widget with that spec. */
    async addCustom(
      description: string,
      chartType: ChartType,
      placement: { x: number; y: number; w: number; h: number },
    ): Promise<void> {
      if (!isSupabaseConfigured) throw new Error('Adding widgets requires a configured Supabase project.');
      if (!user) throw new Error('Not signed in.');
      const { title, spec } = await invoke<{ title: string; spec: WidgetSpec }>('widget-spec', { description });
      const { error } = await supabase.from('report_widgets').insert({
        workspace_id: user.workspaceId,
        kind: 'custom',
        title,
        chart_type: chartType,
        spec,
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
    async changeChartType(id: string, chartType: ChartType): Promise<void> {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.from('report_widgets').update({ chart_type: chartType }).eq('id', id);
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

export type { WidgetSpec } from './customSpec';
