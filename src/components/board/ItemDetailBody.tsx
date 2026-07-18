import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Eyebrow } from '@/components/ui/Card';
import { Tag, PriorityTag } from '@/components/ui/Tag';
import { Segmented } from '@/components/ui/Segmented';
import { useBoardItems, useItemNotes, useAddNote, useMoveItem, useUpdateItem, useBulkActions } from '@/features/board/hooks';
import { RicePopover } from '@/components/board/RicePopover';
import { useAssigneeRoster } from '@/features/team';
import type { BoardItem, ItemNote } from '@/features/board/types';
import type { RequestType } from '@/types/domain';

/**
 * Shared item-detail content — used by the Asana-style slide-over panel
 * (ItemDetailPanel, opened over the current screen) and the standalone
 * /items/:id route (direct links). Sized for the panel's ~35vw width; also
 * reads fine at page width since it never assumes extra horizontal space.
 */
export function ItemDetailBody({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { items } = useBoardItems();
  const item = items.find((i) => i.id === itemId);
  const { notes } = useItemNotes(itemId);
  const addNote = useAddNote(itemId);
  const move = useMoveItem();
  const [channel, setChannel] = useState<'internal' | 'external'>('internal');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  async function onSend() {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await addNote(comment.trim(), channel === 'internal');
      setComment('');
    } finally {
      setSending(false);
    }
  }

  if (!item) {
    return (
      <div className="flex flex-col h-full">
        <PanelHeader itemRef="Item" onClose={onClose} />
        <div className="flex-1 flex items-center justify-center text-sm text-body">Item not found.</div>
      </div>
    );
  }

  const statusLabel =
    item.boardStatus === 'in_development' ? 'In Development'
    : item.boardStatus === 'in_qa' ? 'In QA'
    : item.boardStatus === 'released' ? 'Released' : 'Triaged';
  const external = notes.filter((n) => !n.internal);
  const internal = notes.filter((n) => n.internal);
  const isReleased = item.boardStatus === 'released';

  return (
    <div className="flex flex-col h-full">
      <PanelHeader itemRef={item.ref} onClose={onClose} />
      <div className="flex-1 overflow-y-auto scroll-thin px-6 py-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight leading-snug">{item.title}</h1>
          <button
            onClick={() => !isReleased && move(item.id, 'released')}
            disabled={isReleased}
            className="inline-flex items-center gap-1.5 text-[12px] text-success font-medium hover:opacity-80 disabled:opacity-50 flex-shrink-0 mt-0.5"
          >
            <Icon name="check" size={15} /> {isReleased ? 'Completed' : 'Mark complete'}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <PriorityTag priority={item.priority} />
          <Tag tone="pm">{statusLabel}</Tag>
          {slaLabel(item.createdAt, item.priority, isReleased) && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#9A6410] font-mono">
              <Icon name="schedule" size={13} /> {slaLabel(item.createdAt, item.priority, isReleased)}
            </span>
          )}
        </div>

        {/* Primary fields — every one editable in place: Type/Priority as
            dropdowns, Assignee from the team roster, Created as a date,
            RICE opens the same scoring popover as the Backlog list. */}
        <PrimaryFields key={item.id} item={item} />

        {/* Default task fields — available on every item regardless of
            source, editable inline. */}
        <DefaultFields key={item.id} item={item} />

        {/* Custom fields — created on the fly from the Asana field-mapping
            panel; hidden entirely for items with none, shown only for the
            fields that actually apply here. */}
        {item.customFields && item.customFields.length > 0 && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-4 bg-canvas border-[0.5px] border-hairline rounded-frame p-4">
            {item.customFields.map((f) => (
              <Meta key={f.name} label={f.name} value={f.value} />
            ))}
          </div>
        )}

        {/* Activity — stacked channels (reads well at panel width) */}
        <div className="mt-6 flex flex-col gap-5">
          <Eyebrow>Activity</Eyebrow>
          <Channel title="External · customer sees" dot="#1D9E75" notes={external} />
          <Channel title="Internal · team only" dot="#3F3791" notes={internal} />
        </div>
      </div>

      {/* Comment box — pinned to panel bottom */}
      <div className="flex-shrink-0 border-t-[0.5px] border-hairline p-3">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment…"
          className="w-full text-[13px] outline-none px-1 py-1"
        />
        <div className="flex items-center justify-between mt-2">
          <Segmented
            value={channel}
            onChange={setChannel}
            options={[
              { value: 'internal', label: 'Internal' },
              { value: 'external', label: 'External' },
            ]}
          />
          <button
            onClick={onSend}
            disabled={!comment.trim() || sending}
            className="h-8 px-4 rounded-control bg-navy text-white text-[13px] font-medium disabled:opacity-40 hover:bg-[#152238]"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ itemRef, onClose }: { itemRef: string; onClose: () => void }) {
  return (
    <div className="h-14 flex-shrink-0 flex items-center justify-between px-5 border-b-[0.5px] border-hairline">
      <span className="font-mono text-[12px] text-label">{itemRef}</span>
      <button onClick={onClose} className="text-label hover:text-body" aria-label="Close">
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Eyebrow>{label}</Eyebrow>
      <div className="text-[13px]">{value}</div>
    </div>
  );
}

const fieldInputClass =
  'w-full text-[13px] bg-transparent outline-none border-b-[0.5px] border-transparent hover:border-hairline focus:border-accent pb-0.5';

const TYPE_OPTIONS: { value: RequestType; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'query', label: 'Query' },
  { value: 'request', label: 'Request' },
];

/** Type, Assignee, Created, RICE — the fields that used to be a read-only
 * grid at the top of the panel. Type/Assignee are dropdowns, Created is a
 * date input, and RICE opens the same scoring popover the Backlog list
 * uses (positioned to hang from the left since this panel sits at the
 * right edge of the screen). */
function PrimaryFields({ item }: { item: BoardItem }) {
  const updateItem = useUpdateItem();
  const { assign } = useBulkActions();
  const roster = useAssigneeRoster();
  const [showRice, setShowRice] = useState(false);

  function onAssigneeChange(id: string) {
    const person = id ? roster.find((r) => r.id === id) ?? null : null;
    assign([item.id], person);
  }

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-4 bg-canvas border-[0.5px] border-hairline rounded-frame p-4">
      <div className="flex flex-col gap-1">
        <Eyebrow>Type</Eyebrow>
        <select
          value={item.type}
          onChange={(e) => updateItem(item.id, { type: e.target.value as RequestType })}
          className={fieldInputClass}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Eyebrow>Assignee</Eyebrow>
        <select value={item.assigneeId ?? ''} onChange={(e) => onAssigneeChange(e.target.value)} className={fieldInputClass}>
          <option value="">Unassigned</option>
          {roster.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Eyebrow>Created</Eyebrow>
        <input
          type="date"
          value={item.createdAt ? item.createdAt.slice(0, 10) : ''}
          onChange={(e) =>
            updateItem(item.id, { createdAt: e.target.value ? new Date(e.target.value).toISOString() : null })
          }
          className={fieldInputClass}
        />
      </div>
      <div className="flex flex-col gap-1 relative">
        <Eyebrow>RICE</Eyebrow>
        <button type="button" onClick={() => setShowRice((v) => !v)} className={clsx(fieldInputClass, 'text-left')}>
          {item.riceScore != null ? item.riceScore.toFixed(1) : '—'}
        </button>
        {/* align="right": the RICE field sits in the panel's right-hand
            column, close to the panel's own right edge — a left-hung
            popover would overflow off-screen, so it hangs from the right
            instead (the same reasoning that makes "left" correct for the
            wide Backlog table, inverted for this narrow panel). */}
        {showRice && <RicePopover item={item} onClose={() => setShowRice(false)} align="right" />}
      </div>
    </div>
  );
}

/** Estimated time, Customer name, Module, Tags — standard fields on every
 * task regardless of source, editable directly here. Keyed by item.id in
 * the parent so local edit state resets cleanly when the panel switches
 * to a different item instead of carrying stale values over. */
function DefaultFields({ item }: { item: BoardItem }) {
  const updateItem = useUpdateItem();
  const [estimatedHours, setEstimatedHours] = useState(item.estimatedHours != null ? String(item.estimatedHours) : '');
  const [customerName, setCustomerName] = useState(item.customerName ?? '');
  const [module, setModule] = useState(item.module ?? '');
  const [tagsText, setTagsText] = useState((item.tags ?? []).join(', '));

  function saveEstimatedHours() {
    const n = estimatedHours.trim() === '' ? null : Number(estimatedHours);
    if (n !== null && Number.isNaN(n)) return;
    updateItem(item.id, { estimatedHours: n });
  }
  function saveCustomerName() {
    updateItem(item.id, { customerName: customerName.trim() || null });
  }
  function saveModule() {
    updateItem(item.id, { module: module.trim() || null });
  }
  function saveTags() {
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
    updateItem(item.id, { tags });
  }

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-4 bg-canvas border-[0.5px] border-hairline rounded-frame p-4">
      <div className="flex flex-col gap-1">
        <Eyebrow>Estimated time (h)</Eyebrow>
        <input
          type="number"
          min={0}
          step="0.5"
          value={estimatedHours}
          onChange={(e) => setEstimatedHours(e.target.value)}
          onBlur={saveEstimatedHours}
          placeholder="—"
          className={fieldInputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Eyebrow>Customer</Eyebrow>
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          onBlur={saveCustomerName}
          placeholder="—"
          className={fieldInputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Eyebrow>Module</Eyebrow>
        <input
          value={module}
          onChange={(e) => setModule(e.target.value)}
          onBlur={saveModule}
          placeholder="—"
          className={fieldInputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Eyebrow>Tags</Eyebrow>
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          onBlur={saveTags}
          placeholder="comma, separated"
          className={fieldInputClass}
        />
      </div>
    </div>
  );
}

const SLA_TARGET_H: Record<string, number> = { critical: 8, high: 24, medium: 72, low: 120 };
function slaLabel(createdAt: string | undefined, priority: string, resolved: boolean): string | null {
  if (resolved || !createdAt) return null;
  const target = SLA_TARGET_H[priority] ?? 72;
  const left = target - (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (left <= 0) return `SLA breached ${Math.abs(left).toFixed(0)}h`;
  const h = Math.floor(left);
  const m = Math.floor((left - h) * 60);
  return `${h}h ${m}m · SLA`;
}

function Channel({ title, dot, notes }: { title: string; dot: string; notes: ItemNote[] }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
        <span className="text-[11px] font-medium text-label">{title}</span>
      </div>
      <div className="flex flex-col gap-3">
        {notes.map((n) => (
          <div key={n.id} className="flex gap-2.5">
            <Avatar initials={n.initials} size={24} tone={n.internal ? 'pm' : 'neutral'} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium">{n.author}</span>
                <span className="text-[10px] text-label">{n.ago}</span>
              </div>
              <div
                className={clsx(
                  'text-[12px] leading-relaxed mt-1 rounded-lg px-3 py-2',
                  n.internal ? 'bg-pm-bg text-ink' : 'bg-[#F2F1EE] text-body',
                )}
              >
                {n.body}
              </div>
            </div>
          </div>
        ))}
        {notes.length === 0 && <div className="text-[12px] text-label">No activity yet.</div>}
      </div>
    </div>
  );
}
