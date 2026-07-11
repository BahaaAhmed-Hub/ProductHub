import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Segmented';
import { TypeTag } from '@/components/ui/Tag';
import { StatusBadge } from '@/features/requests/StatusBadge';
import { useRequestsStore } from '@/features/requests/store';
import type { CustomerRequest } from '@/features/requests/types';
import type { RequestType } from '@/types/domain';

type View = 'list' | 'by_type';

export function MyRequestsScreen() {
  const navigate = useNavigate();
  const { requests, selected, toggleSelected, clearSelected, archiveSelected } = useRequestsStore();
  const [view, setView] = useState<View>('list');
  const openCount = requests.filter((r) => r.status !== 'resolved').length;

  const groups: { type: RequestType; label: string; rows: CustomerRequest[] }[] = (
    ['bug', 'feature', 'query'] as RequestType[]
  ).map((type) => ({
    type,
    label: type === 'bug' ? 'Bugs' : type === 'feature' ? 'Features' : 'Queries',
    rows: requests.filter((r) => r.type === type),
  }));

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>
          <p className="text-sm text-body mt-1">Orion Cloud · {openCount} open</p>
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: 'List', icon: 'format_list_bulleted' },
            { value: 'by_type', label: 'By type', icon: 'category' },
          ]}
        />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mt-5 flex items-center justify-between h-11 px-4 rounded-control bg-danger-bg border-[0.5px] border-[#F1C9C7]">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-danger">{selected.size} selected</span>
            <button onClick={clearSelected} className="text-[13px] text-body hover:text-ink">
              Clear
            </button>
          </div>
          <button
            onClick={archiveSelected}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-danger hover:opacity-80"
          >
            <Icon name="archive" size={16} /> Archive selected
          </button>
        </div>
      )}

      <div className="mt-5">
        {/* Header row */}
        <div className="grid grid-cols-[24px_92px_1fr_84px_120px_150px_100px] gap-3 px-3 pb-2 text-eyebrow font-medium uppercase text-label border-b-[0.5px] border-hairline">
          <span />
          <span>Ref</span>
          <span>Subject</span>
          <span>Type</span>
          <span>Status</span>
          <span>Planned</span>
          <span className="text-right">Submitted</span>
        </div>

        {view === 'list' ? (
          requests.map((r) => (
            <RequestRow
              key={r.id}
              r={r}
              selected={selected.has(r.id)}
              onToggle={() => toggleSelected(r.id)}
              onOpen={() => navigate(`/requests/${r.id}`)}
            />
          ))
        ) : (
          <div className="flex flex-col gap-6 mt-2">
            {groups
              .filter((g) => g.rows.length > 0)
              .map((g) => (
                <div key={g.type}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <TypeTag type={g.type} />
                    <span className="text-[13px] font-medium">{g.label}</span>
                    <span className="text-[11px] text-label">{g.rows.length}</span>
                  </div>
                  {g.rows.map((r) => (
                    <RequestRow
                      key={r.id}
                      r={r}
                      selected={selected.has(r.id)}
                      onToggle={() => toggleSelected(r.id)}
                      onOpen={() => navigate(`/requests/${r.id}`)}
                    />
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestRow({
  r,
  selected,
  onToggle,
  onOpen,
}: {
  r: CustomerRequest;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className={clsx(
        'grid grid-cols-[24px_92px_1fr_84px_120px_150px_100px] gap-3 items-center px-3 h-12 border-b-[0.5px] border-hairline cursor-pointer',
        selected ? 'bg-accent-bg shadow-[inset_2px_0_0_#378ADD]' : 'hover:bg-[#F7F7F5]',
      )}
      onClick={onOpen}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex items-center justify-center"
        aria-label={selected ? 'Deselect' : 'Select'}
      >
        <span
          className={clsx(
            'w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center',
            selected ? 'bg-navy border-navy' : 'border-[#C8C5BF] bg-surface',
          )}
        >
          {selected && <Icon name="check" size={13} className="text-white" />}
        </span>
      </button>
      <span className="font-mono text-[11px] text-label">{r.ref}</span>
      <span className="text-[13px] font-medium truncate">{r.subject}</span>
      <span>
        <TypeTag type={r.type} />
      </span>
      <span>
        <StatusBadge status={r.status} />
      </span>
      <span className="text-[12px] text-body truncate">{r.plannedRelease ?? '—'}</span>
      <span className="text-right">
        <span className="text-[12px] text-body">{r.submittedOn}</span>
      </span>
    </div>
  );
}
