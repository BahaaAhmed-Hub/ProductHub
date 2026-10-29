// Shared by asana-sync and asana-push: how ProductHub fields line up with Asana
// fields by name, and how option labels translate to ProductHub enum values.
// ---- Same-name auto-mapping ------------------------------------------------
// With no explicit field mapping for a target, an Asana custom field whose
// NAME matches the ProductHub field (Priority, Type, Module, Customer,
// Estimated time, Status) is used directly, and its values are translated by
// keyword. Explicit mappings always win.
export const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const FIELD_NAMES: Record<string, string[]> = {
  priority: ['priority', 'severity', 'urgency'],
  type: ['type', 'task type', 'issue type', 'ticket type', 'kind', 'category'],
  status: ['status', 'stage', 'state', 'progress'],
  module: ['module', 'component', 'area', 'feature area', 'product area'],
  customer: ['customer', 'customer name', 'client', 'account'],
  estimated: ['estimated time', 'estimated hours', 'estimate', 'estimation', 'time estimate'],
};
/** The custom field (on a task, or a project's field list) whose name matches `key`'s aliases. */
export function namedField<T extends { name?: string }>(fields: T[], key: keyof typeof FIELD_NAMES): T | undefined {
  const names = FIELD_NAMES[key];
  return fields.find((c) => c.name && names.includes(norm(c.name)));
}
export function priorityFrom(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const x = norm(v);
  if (/^(critical|urgent|blocker|highest|p0|sev 1|severity 1)$/.test(x)) return 'critical';
  if (/^(high|major|important|p1|sev 2|severity 2)$/.test(x)) return 'high';
  if (/^(medium|normal|moderate|med|p2|sev 3|severity 3)$/.test(x)) return 'medium';
  if (/^(low|minor|lowest|trivial|p3|p4|sev 4|severity 4)$/.test(x)) return 'low';
  return undefined;
}
export function typeFrom(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const x = norm(v);
  if (/\b(bug|defect|incident|error)\b/.test(x)) return 'bug';
  if (/\b(feature|enhancement|story|improvement|epic)\b/.test(x)) return 'feature';
  if (/\brequest\b/.test(x)) return 'request';
  if (/\b(query|question|inquiry)\b/.test(x)) return 'query';
  return undefined;
}
export function statusFrom(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const x = norm(v);
  if (/\b(done|complete|completed|released|shipped|closed|resolved|deployed|live)\b/.test(x)) return 'released';
  if (/\b(qa|test|testing|review|verify|verification|uat)\b/.test(x)) return 'in_qa';
  if (/\b(progress|doing|dev|development|started|active|wip|building)\b/.test(x)) return 'in_development';
  if (/\b(backlog|todo|to do|new|open|triage|triaged|planned|not started|inbox)\b/.test(x)) return 'triaged';
  return undefined;
}
/** A section/column that means "finished" — tasks in it are completed here regardless of field mappings. */
export const COMPLETED_SECTION = /^(done|completed?|closed|resolved|finished|shipped|released)$/i;
export const ARCHIVED_SECTION = /^archived?$/i;

