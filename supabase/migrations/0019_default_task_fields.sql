-- ProductHub — default task fields (Estimated time, Customer name, Module,
-- Tags) available on every backlog item regardless of source, plus a new
-- 'request' task type alongside the existing bug/feature/query (additive —
-- nothing renamed or removed, so no existing data or refs are touched).

alter type request_type add value if not exists 'request';

alter table backlog_items add column if not exists estimated_hours numeric;
alter table backlog_items add column if not exists customer_name text;
alter table backlog_items add column if not exists module text;
alter table backlog_items add column if not exists tags text[] not null default '{}'::text[];

-- These four are now also valid Asana field-mapping targets, alongside the
-- existing enum/description/custom-field targets.
alter table integration_field_mappings drop constraint if exists integration_field_mappings_target_field_check;
alter table integration_field_mappings add constraint integration_field_mappings_target_field_check
  check (target_field in (
    'board_status', 'priority', 'type', 'description', 'custom',
    'estimated_hours', 'customer_name', 'module', 'tags', 'ignore'
  ));
