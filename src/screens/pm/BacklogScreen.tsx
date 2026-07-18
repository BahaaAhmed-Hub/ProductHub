import { useState } from 'react';
import clsx from 'clsx';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Segmented } from '@/components/ui/Segmented';
import { Tag, TypeTag, PriorityTag } from '@/components/ui/Tag';
import { BOARD_COLUMNS } from '@/features/board/types';
import { useBoardItems, useMoveItem, useBulkActions } from '@/features/board/hooks';
import { useItemPanel } from '@/features/board/panelStore';
import { NewItemDialog } from '@/components/board/NewItemDialog';
import { RicePopover } from '@/components/board/RicePopover';
import { useAssigneeRoster } from '@/features/team';
import type { BoardItem } from '@/features/board/types';
import type { BoardStatus } from '@/types/domain';

const PLAN_TONE: Record<string, 'neutral' | 'accent' | 'success'> = {
  backlog: 'neutral',
  planned: 'accent',
  in_cycle: 'success',
};
const PLAN_LABEL: Record<string, string> = { backlog: 'Backlog', planned: 'Planned', in_cycle: 'In Cycle' };

/** Screen 17 — PM backlog: list w/ inline RICE scoring, or kanban board. */
export function BacklogScreen() {
  const openItem = useItemPanel((s) => s.open);
  const { items, isLoading } = useBoardItems();
  const [view, setView] = useState<'list' | 'board'>('list');
  const [scoring, setScoring] = useState<string | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((s) => (s.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  return (
    <>
      <TopNav
        center={
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-body">Backlog</span>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: 'List', icon: 'format_list_bulleted' },
                { value: 'board', label: 'Board', icon: 'view_kanban' },
              ]}
            />
          </div>
        }
        notificationCount={4}
      />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Backlog</h1>
            <span className="text-xs text-label">{items.length} items</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon="tune">Filter</Button>
            <Button icon="add" onClick={() => setShowNewItem(true)}>New item</Button>
          </div>
        </div>

        {view === 'list' && selected.size > 0 && (
          <BulkActionBar
            count={selected.size}
            ids={[...selected]}
            onClear={() => setSelected(new Set())}
          />
        )}

        {isLoading && <div className="text-sm text-body">Loading…</div>}

        {!isLoading && items.length === 0 && (
          <div className="max-w-md rounded-frame border border-dashed border-hairline p-8 text-center">
            <div className="text-sm font-medium">Backlog is empty</div>
            <p className="text-[13px] text-body mt-1">
              Add a task directly with <b>New item</b>, or triage an incoming customer request from the Triage Inbox.
            </p>
            <button className="text-accent text-[13px] mt-3" onClick={() => setShowNewItem(true)}>
              + New item
            </button>
          </div>
        )}

        {!isLoading && items.length > 0 && view === 'list' && (
          <ListView
            items={items}
            scoring={scoring}
            setScoring={setScoring}
            onOpen={openItem}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
          />
        )}
        {!isLoading && items.length > 0 && view === 'board' && <BoardView items={items} onOpen={openItem} />}
      </div>

      {showNewItem && <NewItemDialog onClose={() => setShowNewItem(false)} />}
    </>
  );
}

function BulkActionBar({ count, ids, onClear }: { count: number; ids: string[]; onClear: () => void }) {
  const bulk = useBulkActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pickingAssignee, setPickingAssignee] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string, fn: () => Promise<void>) {
    setBusy(action);
    setError(null);
    try {
      await fn();
      onClear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="relative flex-shrink-0 mb-3 flex items-center gap-2 px-3.5 h-11 rounded-control bg-navy text-white">
      <span className="text-[13px] font-medium">{count} selected</span>
      <span className="w-px h-4 bg-white/20 mx-1" />

      {confirmingDelete ? (
        <>
          <span className="text-[13px]">Delete {count} item{count === 1 ? '' : 's'}?</span>
          <Button
            variant="danger"
            className="h-7 text-[12px] px-2.5"
            disabled={busy === 'delete'}
            onClick={() => run('delete', () => bulk.remove(ids))}
          >
            {busy === 'delete' ? 'Deleting…' : 'Confirm delete'}
          </Button>
          <Button variant="ghost" className="h-7 text-[12px] px-2.5 text-white hover:bg-white/10" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <button
            className="flex items-center gap-1.5 text-[13px] px-2 h-7 rounded-md hover:bg-white/10 disabled:opacity-50"
            disabled={busy !== null}
            onClick={() => run('complete', () => bulk.complete(ids))}
          >
            <Icon name="check_circle" size={15} /> {busy === 'complete' ? 'Completing…' : 'Complete'}
          </button>
          <button
            className="flex items-center gap-1.5 text-[13px] px-2 h-7 rounded-md hover:bg-white/10"
            onClick={() => setPickingAssignee((p) => !p)}
          >
            <Icon name="groups" size={15} /> Assign to
          </button>
          <button
            className="flex items-center gap-1.5 text-[13px] px-2 h-7 rounded-md hover:bg-white/10"
            onClick={() => setConfirmingDelete(true)}
          >
            <Icon name="archive" size={15} /> Delete
          </button>
        </>
      )}

      {error && <span className="text-[12px] text-[#FFD9D6]">{error}</span>}

      <button className="ml-auto text-white/70 hover:text-white" onClick={onClear} aria-label="Clear selection">
        <Icon name="close" size={16} />
      </button>

      {pickingAssignee && (
        <AssigneePicker
          onPick={(assignee) => run('assign', () => bulk.assign(ids, assignee))}
          onClose={() => setPickingAssignee(false)}
        />
      )}
    </div>
  );
}

function AssigneePicker({
  onPick,
  onClose,
}: {
  onPick: (assignee: { id: string; name: string; initials: string } | null) => void;
  onClose: () => void;
}) {
  const roster = useAssigneeRoster();

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-12 z-50 w-[220px] bg-surface border-[0.5px] border-hairline rounded-frame shadow-pop overflow-hidden text-ink">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[#F4F3F0] border-b-[0.5px] border-hairline"
          onClick={() => { onPick(null); onClose(); }}
        >
          <span className="w-6 h-6 rounded-full border border-dashed border-hairline flex-shrink-0" />
          Unassign
        </button>
        {roster.length === 0 && <div className="px-3 py-3 text-[12px] text-label">No team members found.</div>}
        {roster.map((m) => (
          <button
            key={m.id}
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[#F4F3F0]"
            onClick={() => { onPick(m); onClose(); }}
          >
            <Avatar initials={m.initials} size={24} />
            {m.name}
          </button>
        ))}
      </div>
    </>
  );
}

function ListView({
  items,
  scoring,
  setScoring,
  onOpen,
  selected,
  onToggle,
  onToggleAll,
}: {
  items: BoardItem[];
  scoring: string | null;
  setScoring: (id: string | null) => void;
  onOpen: (id: string) => void;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <div className="bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame overflow-visible">
      <div className="grid grid-cols-[28px_92px_1fr_84px_90px_70px_90px] gap-3 px-4 py-2.5 text-eyebrow font-medium uppercase text-label border-b-[0.5px] border-hairline items-center">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected; }}
          onChange={onToggleAll}
          className="accent-navy"
          aria-label="Select all"
        />
        <span>Ref</span><span>Title</span><span>Type</span>
        <span>Priority</span><span className="text-right">RICE</span><span className="text-right">Plan</span>
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className={clsx(
            'relative grid grid-cols-[28px_92px_1fr_84px_90px_70px_90px] gap-3 items-center px-4 h-12 border-b-[0.5px] border-hairline last:border-0 hover:bg-[#F7F7F5]',
            selected.has(item.id) && 'bg-accent-bg hover:bg-accent-bg',
          )}
        >
          <input
            type="checkbox"
            checked={selected.has(item.id)}
            onChange={() => onToggle(item.id)}
            className="accent-navy"
            aria-label={`Select ${item.ref}`}
          />
          <span className="font-mono text-[11px] text-label">{item.ref}</span>
          <span className="text-[13px] font-medium truncate cursor-pointer" onClick={() => onOpen(item.id)}>
            {item.title}
          </span>
          <span><TypeTag type={item.type} /></span>
          <span><PriorityTag priority={item.priority} /></span>
          <button
            className="text-[13px] font-mono font-semibold text-right hover:text-pm"
            onClick={() => setScoring(scoring === item.id ? null : item.id)}
          >
            {item.riceScore?.toFixed(1) ?? '—'}
          </button>
          <span className="text-right">
            {item.planBucket && (
              <Tag tone={PLAN_TONE[item.planBucket] ?? 'neutral'}>{PLAN_LABEL[item.planBucket] ?? item.planBucket}</Tag>
            )}
          </span>
          {scoring === item.id && <RicePopover item={item} onClose={() => setScoring(null)} />}
        </div>
      ))}
    </div>
  );
}

function BoardView({ items, onOpen }: { items: BoardItem[]; onOpen: (id: string) => void }) {
  const move = useMoveItem();
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className="flex-1 flex gap-3 min-h-0">
      {BOARD_COLUMNS.map((col) => {
        const colItems = items.filter((i) => i.boardStatus === col.status);
        return (
          <div
            key={col.status}
            className="flex-1 flex flex-col gap-2 min-w-0 border-[0.5px] border-hairline rounded-frame bg-surface/50 p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) move(dragId, col.status as BoardStatus);
              setDragId(null);
            }}
          >
            <div className="flex items-center gap-2 px-0.5 pb-0.5 flex-shrink-0">
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: col.dot }} />
              <span className="text-xs font-semibold">{col.label}</span>
              <span className="min-w-4 h-[15px] px-1.5 rounded-full bg-[#EFEEE9] text-[#5F5E57] text-[10px] font-semibold flex items-center justify-center">
                {colItems.length}
              </span>
            </div>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto scroll-thin">
              {colItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDragId(item.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onOpen(item.id)}
                  className={clsx(
                    'bg-surface border-[0.5px] border-hairline rounded-[10px] p-2.5 flex flex-col gap-1.5 cursor-grab active:cursor-grabbing hover:shadow-frame',
                    item.priority === 'critical' && 'border-l-2 border-l-danger',
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] text-label">{item.ref}</span>
                    <TypeTag type={item.type} />
                  </div>
                  <div className="text-xs font-medium leading-snug">{item.title}</div>
                  <PriorityTag priority={item.priority} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

