import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import {
  useAsanaFields, useFieldMappings, useFieldMappingActions,
  type AsanaField, type FieldMapping, type MappingTarget,
} from './asana';

const TARGET_LABEL: Record<MappingTarget, string> = {
  ignore: "Don't sync",
  board_status: 'Status',
  priority: 'Priority',
  type: 'Type',
};

const TARGET_OPTIONS: Record<Exclude<MappingTarget, 'ignore'>, string[]> = {
  board_status: ['triaged', 'in_development', 'in_qa', 'released'],
  priority: ['low', 'medium', 'high', 'critical'],
  type: ['bug', 'feature', 'query'],
};

function FieldMappingRow({
  field,
  mapping,
  onSave,
  onRemove,
}: {
  field: AsanaField;
  mapping: FieldMapping | undefined;
  onSave: (field: AsanaField, target: MappingTarget, valueMap: Record<string, string>) => Promise<void>;
  onRemove: (sourceField: string) => Promise<void>;
}) {
  const [target, setTarget] = useState<MappingTarget>(mapping?.targetField ?? 'ignore');
  const [valueMap, setValueMap] = useState<Record<string, string>>(mapping?.valueMap ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetOptions = target === 'ignore' ? [] : TARGET_OPTIONS[target];

  async function onSaveClick() {
    setBusy(true);
    setError(null);
    try {
      if (target === 'ignore') {
        if (mapping) await onRemove(field.sourceField);
      } else {
        await onSave(field, target, valueMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-3 border-b-[0.5px] border-hairline last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium truncate">{field.label}</span>
        <select
          value={target}
          onChange={(e) => {
            setTarget(e.target.value as MappingTarget);
            setValueMap({});
          }}
          className="h-7 px-2 rounded-control border-[0.5px] border-hairline bg-surface text-[11px] outline-none flex-shrink-0"
        >
          {(Object.keys(TARGET_LABEL) as MappingTarget[]).map((t) => (
            <option key={t} value={t}>{TARGET_LABEL[t]}</option>
          ))}
        </select>
      </div>

      {target !== 'ignore' && field.options.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5 pl-2">
          {field.options.map((opt) => (
            <div key={opt} className="flex items-center gap-2 text-[12px]">
              <span className="flex-1 text-label truncate">{opt}</span>
              <Icon name="north_east" size={12} className="text-label flex-shrink-0" />
              <select
                value={valueMap[opt] ?? ''}
                onChange={(e) => setValueMap((m) => ({ ...m, [opt]: e.target.value }))}
                className="h-7 px-2 rounded-control border-[0.5px] border-hairline bg-surface text-[11px] outline-none flex-shrink-0"
              >
                <option value="">—</option>
                {targetOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <Button variant="secondary" disabled={busy} onClick={onSaveClick} className="h-7 text-[11px] px-2.5">
          {busy ? 'Saving…' : 'Save'}
        </Button>
        {error && <span className="text-[11px] text-danger">{error}</span>}
      </div>
    </div>
  );
}

/** Lets a Manager map whatever fields the connected Asana project actually
 * has — its sections plus any enum/multi_enum custom field, discovered live
 * — onto ProductHub's status/priority/type. A project that gains a new
 * custom field later just shows up here on next open; nothing hardcoded. */
export function AsanaFieldMapping({ onClose }: { onClose: () => void }) {
  const { fields, isLoading, load } = useAsanaFields();
  const { mappings } = useFieldMappings();
  const actions = useFieldMappingActions();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mappingByField = new Map(mappings.map((m) => [m.sourceField, m]));

  return (
    <div className="border-[0.5px] border-hairline rounded-control p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-semibold">Field mapping</span>
        <button onClick={onClose} aria-label="Close">
          <Icon name="close" size={14} className="text-label" />
        </button>
      </div>
      <p className="text-[11px] text-label mb-2">
        Map Asana's sections and custom fields onto status, priority, and type. Unmapped fields aren't synced.
      </p>
      {isLoading ? (
        <div className="text-[12px] text-label py-2">Loading fields…</div>
      ) : fields.length === 0 ? (
        <div className="text-[12px] text-label py-2">No mappable fields found on this project.</div>
      ) : (
        fields.map((f) => (
          <FieldMappingRow key={f.sourceField} field={f} mapping={mappingByField.get(f.sourceField)} onSave={actions.save} onRemove={actions.remove} />
        ))
      )}
    </div>
  );
}
