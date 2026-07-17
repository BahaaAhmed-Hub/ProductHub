import { useRef, useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Tag, TypeTag } from '@/components/ui/Tag';
import { useBoardItems, useUpdateItem } from '@/features/board/hooks';
import { useReleases, usePlanningActions } from '@/features/planning';

const STATUS_TONE: Record<string, 'success' | 'accent' | 'neutral'> = {
  on_track: 'success', released: 'success', at_risk: 'accent', planned: 'neutral',
};

/** Screens 19/20 — PM release tree (list + board), real releases. */
export function ReleaseTreeScreen() {
  const { releases } = useReleases();
  const { items } = useBoardItems();
  const update = useUpdateItem();
  const actions = usePlanningActions();
  const [view, setView] = useState<'list' | 'board'>('list');
  const [newRel, setNewRel] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const newRelInput = useRef<HTMLInputElement>(null);

  function submitRelease() {
    if (!newRel.trim()) {
      setNeedsName(true);
      newRelInput.current?.focus();
      return;
    }
    setNeedsName(false);
    actions.addRelease(newRel.trim());
    setNewRel('');
  }

  const groups = [
    ...releases.map((r) => ({ id: r.id, name: r.name, status: r.status, items: items.filter((i) => i.releaseId === r.id) })),
    { id: null as string | null, name: 'Unassigned', status: 'planned', items: items.filter((i) => !i.releaseId) },
  ];

  return (
    <>
      <TopNav
        center={
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-body">Release Tree</span>
            <Segmented value={view} onChange={setView} options={[
              { value: 'list', label: 'List', icon: 'account_tree' },
              { value: 'board', label: 'Board', icon: 'view_kanban' },
            ]} />
          </div>
        }
        notificationCount={4}
      />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <div className="mb-4 max-w-md">
          <div className="flex items-center gap-2">
            <input
              ref={newRelInput}
              value={newRel}
              onChange={(e) => {
                setNewRel(e.target.value);
                if (needsName) setNeedsName(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitRelease()}
              placeholder="New release name…"
              className={`flex-1 h-9 px-3 rounded-control border-[0.5px] text-sm outline-none focus:border-accent ${
                needsName ? 'border-danger' : 'border-hairline'
              }`}
            />
            <Button icon="add" onClick={submitRelease}>
              Add release
            </Button>
          </div>
          {needsName && <p className="text-[12px] text-danger mt-1">Give the release a name first.</p>}
        </div>

        <div className={view === 'board' ? 'flex gap-3 items-start' : 'flex flex-col gap-4 max-w-4xl'}>
          {groups.map((g) => (
            <div
              key={g.id ?? 'none'}
              className={view === 'board' ? 'flex-1 min-w-0 bg-surface border-[0.5px] border-hairline rounded-frame p-3' : 'bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame p-4'}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon name="account_tree" size={15} className="text-pm" />
                <span className="text-[14px] font-semibold">{g.name}</span>
                {g.id && <Tag tone={STATUS_TONE[g.status] ?? 'neutral'}>{g.status.replace('_', ' ')}</Tag>}
                <span className="text-[11px] text-label ml-auto">{g.items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {g.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg border-[0.5px] border-hairline px-3 py-2">
                    <span className="font-mono text-[10px] text-label">{item.ref}</span>
                    <TypeTag type={item.type} />
                    <span className="text-[12px] flex-1 truncate">{item.title}</span>
                    <select
                      value={item.releaseId ?? ''}
                      onChange={(e) => update(item.id, { releaseId: e.target.value || undefined })}
                      className="text-[11px] h-6 rounded border-[0.5px] border-hairline bg-surface outline-none"
                    >
                      <option value="">Unassigned</option>
                      {releases.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                ))}
                {g.items.length === 0 && <div className="text-[12px] text-label px-1">No items</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
