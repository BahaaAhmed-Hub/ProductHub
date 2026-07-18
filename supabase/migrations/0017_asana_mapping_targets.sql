-- ProductHub — let field mappings target "description" too, not just the
-- three enum columns. Needed to cover every Asana custom field type (text,
-- number, date, people, multi_enum) and built-in fields like due date —
-- none of those have a dedicated ProductHub column to translate values
-- into, so "append to description" is where they go.
alter table integration_field_mappings drop constraint if exists integration_field_mappings_target_field_check;
alter table integration_field_mappings add constraint integration_field_mappings_target_field_check
  check (target_field in ('board_status', 'priority', 'type', 'description', 'ignore'));
