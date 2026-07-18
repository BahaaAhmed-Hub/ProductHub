-- ProductHub — Reports widgets: a switchable chart type (bar/pie/list/number)
-- per widget, and a 'custom' kind whose data is described in plain English
-- and translated to a small aggregation spec by AI (widget-spec Edge
-- Function) rather than picked from the fixed library. Idempotent.

alter table report_widgets add column if not exists chart_type text not null default 'bar';
alter table report_widgets drop constraint if exists report_widgets_chart_type_check;
alter table report_widgets add constraint report_widgets_chart_type_check
  check (chart_type in ('bar', 'pie', 'list', 'number'));

-- {groupBy, metric, filter?} — computed client-side against already-loaded
-- board items (never executed as a query), so a bad/hallucinated field name
-- just yields an empty chart, not an error.
alter table report_widgets add column if not exists spec jsonb;

alter table report_widgets drop constraint if exists report_widgets_kind_check;
alter table report_widgets add constraint report_widgets_kind_check check (kind in (
  'by_type', 'by_status', 'by_priority', 'sla_breaches', 'recent_activity', 'team_workload', 'rice_top', 'custom'
));
