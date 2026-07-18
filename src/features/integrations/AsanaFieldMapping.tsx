import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import {
  useAsanaFields, useFieldMappings, useFieldMappingActions,
  type AsanaField, type MappingTarget,
} from './asana';

// '__create_custom__' is a UI-only sentinel — never persisted. Selecting it
// resolves (find-or-create) a custom_field_defs row on save and the
// mapping is actually stored with target_field: 'custom'.
type DraftTarget = MappingTarget | '__create_custom__';

const TARGET_LABEL: Record<DraftTarget, string> = {
  ignore: "Don't sync",
  board_status: 'Status',
  priority: 'Priority',
  type: 'Type',
  description: 'Append to description',
  custom: 'Custom field',
  __create_custom__: '+ Create custom field',
  estimated_hours: 'Estimated time',
  customer_name: 'Customer',
  module: 'Module',
  tags: 'Tags',
};

const ENUM_TARGET_OPTIONS: Record<'board_status' | 'priority' | 'type', string[]> = {
  board_status: ['triaged', 'in_development', 'in_qa', 'released'],
  priority: ['low', 'medium', 'high', 'critical'],
  type: ['bug', 'feature', 'query', 'request'],
};

// Direct-value targets — no fixed option set, the field's raw (or
// display_value-formatted) value is written straight into that column.
const DIRECT_TARGETS: DraftTarget[] = ['description', 'estimated_hours', 'customer_name', 'module', 'tags', '__create_custom__'];

/** 'enum' kind fields (a section, or an enum custom field) have a known set
 * of options and can translate into a ProductHub enum column. Every field,
 * regardless of kind, can also land directly in one of the default task
 * fields, become its own custom field, or be appended to the description. */
function targetsFor(field: AsanaField): DraftTarget[] {
  const base: DraftTarget[] = ['ignore', ...DIRECT_TARGETS];
  return field.kind === 'enum' ? ['ignore', 'board_status', 'priority', 'type', ...DIRECT_TARGETS] : base;
}

interface Draft {
  target: DraftTarget;
  valueMap: Record<string, string>;
  /** Set once an existing 'custom' mapping is loaded, so re-saving without
   * touching the dropdown reuses the same field instead of creating a
   * second one with the same name. */
  existingCustomFieldDefId: string | null;
}

function FieldMappingRow({
  field,
  draft,
  onChange,
}: {
  field: AsanaField;
  draft: Draft;
  onChange: (next: Draft) => void;
}) {
  const isEnumTarget = draft.target === 'board_status' || draft.target === 'priority' || draft.target === 'type';
  const targetOptions = isEnumTarget ? ENUM_TARGET_OPTIONS[draft.target as 'board_status' | 'priority' | 'type'] : [];

  return (
    <div className="py-3 border-b-[0.5px] border-hairline last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium truncate">{field.label}</span>
        <select
          value={draft.target}
          onChange={(e) => onChange({ ...draft, target: e.target.value as DraftTarget, valueMap: {} })}
          className="h-7 px-2 rounded-control border-[0.5px] border-hairline bg-surface text-[11px] outline-none flex-shrink-0"
        >
          {targetsFor(field).map((t) => (
            <option key={t} value={t}>{TARGET_LABEL[t]}</option>
          ))}
        </select>
      </div>

      {isEnumTarget && field.options.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5 pl-2">
          {field.options.map((opt) => (
            <div key={opt} className="flex items-center gap-2 text-[12px]">
              <span className="flex-1 text-label truncate">{opt}</span>
              <Icon name="north_east" size={12} className="text-label flex-shrink-0" />
              <select
                value={draft.valueMap[opt] ?? ''}
                onChange={(e) => onChange({ ...draft, valueMap: { ...draft.valueMap, [opt]: e.target.value } })}
                className="h-7 px-2 rounded-control border-[0.5px] border-hairline bg-surface text-[11px] outline-none flex-shrink-0"
              >
                <option value="">—</option>
                {targetOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
      {draft.target === 'description' && (
        <div className="mt-1.5 pl-2 text-[11px] text-label">Appended as "{field.label}: value" on every synced item.</div>
      )}
      {(draft.target === 'estimated_hours' || draft.target === 'customer_name' || draft.target === 'module' || draft.target === 'tags') && (
        <div className="mt-1.5 pl-2 text-[11px] text-label">
          Written into every synced item's {TARGET_LABEL[draft.target]} field, overwriting whatever's there.
        </div>
      )}
      {(draft.target === '__create_custom__' || draft.target === 'custom') && (
        <div className="mt-1.5 pl-2 text-[11px] text-label">
          Creates a "{field.label}" custom field, shown on every synced item's detail panel.
        </div>
      )}
    </div>
  );
}

/** Lets a Manager map whatever fields the given Asana project (one of
 * possibly several added — the caller picks which) actually has — sections,
 * every custom field regardless of type, and a few built-in task fields —
 * discovered live, nothing hardcoded. Enum-kind fields (sections, enum
 * custom fields) translate into status/priority/type value by value; any
 * field can also become a real custom field (shown on the item detail
 * panel) or be appended to the description. Mappings are workspace-wide,
 * not per-project — a source field gid is already project-specific (Asana
 * never reuses one across projects), so the same mapping table naturally
 * covers every added project without extra scoping. All changes are staged
 * locally and written with the single Save button below — no per-row save. */
export function AsanaFieldMapping({ projectGid, onClose }: { projectGid: string; onClose: () => void }) {
  const { fields, isLoading, load } = useAsanaFields(projectGid);
  const { mappings } = useFieldMappings();
  const actions = useFieldMappingActions();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
    // Reset drafts when switching projects — otherwise a field gid from the
    // previous project could linger in state under a stale key.
    setDrafts({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectGid]);

  // Seed drafts from the saved mappings once, when fields+mappings are both
  // in — not on every mappings refetch, or an in-progress edit would be
  // clobbered by the invalidation Save itself triggers.
  const mappingByField = useMemo(() => new Map(mappings.map((m) => [m.sourceField, m])), [mappings]);
  useEffect(() => {
    if (fields.length === 0) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const f of fields) {
        if (next[f.sourceField]) continue;
        const m = mappingByField.get(f.sourceField);
        next[f.sourceField] = m
          ? { target: m.targetField, valueMap: m.valueMap, existingCustomFieldDefId: m.customFieldDefId }
          : { target: 'ignore', valueMap: {}, existingCustomFieldDefId: null };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, mappingByField]);

  async function onSaveAll() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      for (const field of fields) {
        const draft = drafts[field.sourceField];
        if (!draft) continue;
        const existing = mappingByField.get(field.sourceField);

        if (draft.target === 'ignore') {
          if (existing) await actions.remove(field.sourceField);
          continue;
        }
        if (draft.target === '__create_custom__') {
          const defId = draft.existingCustomFieldDefId ?? (await actions.ensureCustomFieldDef(field.label));
          await actions.save(field, 'custom', {}, defId);
          continue;
        }
        const isEnumTarget = draft.target === 'board_status' || draft.target === 'priority' || draft.target === 'type';
        await actions.save(field, draft.target, isEnumTarget ? draft.valueMap : {});
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the mapping.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-semibold">Field mapping</span>
        <button onClick={onClose} aria-label="Close">
          <Icon name="close" size={14} className="text-label" />
        </button>
      </div>
      <p className="text-[11px] text-label mb-2">
        Map every field this project has onto status, priority, type, estimated time, customer, module, tags, a new
        custom field, or the description. Unmapped fields aren't synced.
      </p>
      {isLoading ? (
        <div className="text-[12px] text-label py-2">Loading fields…</div>
      ) : fields.length === 0 ? (
        <div className="text-[12px] text-label py-2">No mappable fields found on this project.</div>
      ) : (
        <>
          {fields.map((f) => (
            <FieldMappingRow
              key={f.sourceField}
              field={f}
              draft={drafts[f.sourceField] ?? { target: 'ignore', valueMap: {}, existingCustomFieldDefId: null }}
              onChange={(next) => setDrafts((d) => ({ ...d, [f.sourceField]: next }))}
            />
          ))}
          <div className="flex items-center gap-2 pt-3">
            <Button disabled={saving} onClick={onSaveAll}>
              {saving ? 'Saving…' : 'Save mapping'}
            </Button>
            {saved && !saving && <span className="text-[11px] text-success">Saved.</span>}
            {error && <span className="text-[11px] text-danger">{error}</span>}
          </div>
        </>
      )}
    </div>
  );
}
