import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Eyebrow } from '@/components/ui/Card';
import { Tag, PriorityTag } from '@/components/ui/Tag';
import { Segmented } from '@/components/ui/Segmented';
import { useBoardItems, useItemNotes, useAddNote, useUpdateItem, useBulkActions } from '@/features/board/hooks';
import { RicePopover } from '@/components/board/RicePopover';
import { useAssigneeRoster } from '@/features/team';
import { useModules } from '@/features/modules';
import { detectModule, detectType } from '@/features/board/detect';
import { classifyItems } from '@/features/ai';
import { useAsanaConnection, pushToAsana, summarizePush } from '@/features/integrations/asana';
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
  const bulk = useBulkActions();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [alsoAsana, setAlsoAsana] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const item = items.find((i) => i.id === itemId);
  const { notes } = useItemNotes(itemId);
  const addNote = useAddNote(itemId);
  const [channel, setChannel] = useState<'internal' | 'external'>('internal');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  async function onDelete() {
    setDeleting(true);
    setActionError(null);
    try {
      await bulk.remove([itemId], { alsoAsana });
      onClose();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete the task.');
    } finally {
      setDeleting(false);
    }
  }

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
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <button
            onClick={() => {
              setActionError(null);
              (isReleased ? bulk.reopen([item.id]) : bulk.complete([item.id])).catch((e: unknown) =>
                setActionError(e instanceof Error ? e.message : 'Action failed.'),
              );
            }}
            className="inline-flex items-center gap-1.5 text-[12px] text-success font-medium hover:opacity-80 flex-shrink-0 mt-0.5"
          >
            <Icon name="check" size={15} /> {isReleased ? 'Completed · Reopen' : 'Mark complete'}
          </button>
          <AsanaSyncButton item={item} onResult={setActionNote} />
          <button
            type="button"
            onClick={() => { setConfirmDelete((v) => !v); setActionError(null); }}
            title="Delete task"
            aria-label="Delete task"
            className="w-7 h-7 rounded-md flex items-center justify-center text-label hover:text-danger hover:bg-[#F4F3F0]"
          >
            <Icon name="delete" size={16} />
          </button>
          </div>
        </div>
        {actionError && <div className="text-[12px] text-danger mt-1">{actionError}</div>}
        {actionNote && (
          <div className={clsx('text-[12px] mt-1', actionNote.ok ? 'text-success' : 'text-danger')}>{actionNote.text}</div>
        )}
        {confirmDelete && (
          <div className="mt-3 rounded-frame border border-danger p-3">
            <div className="text-[13px] font-medium">Delete {item.ref}?</div>
            <div className="text-[12px] text-body mt-0.5">This removes the task and its comments from ProductHub.</div>
            {item.externalSource === 'asana' && (
              <label className="flex items-start gap-2 mt-2 text-[12px] cursor-pointer">
                <input type="checkbox" className="mt-0.5 accent-navy" checked={alsoAsana} onChange={(e) => setAlsoAsana(e.target.checked)} />
                <span>
                  Also delete it in Asana
                  <span className="block text-[11px] text-label">
                    If unchecked, it stays in Asana and the next sync brings it back.
                  </span>
                </span>
              </label>
            )}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                disabled={deleting}
                onClick={onDelete}
                className="h-8 px-3 rounded-control bg-danger text-white text-[12px] font-medium disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete task'}
              </button>
              <button type="button" className="h-8 px-3 text-[12px] text-body" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        )}
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
        <PrimaryFields key={`primary-${item.id}`} item={item} />

        <DetectBar item={item} />

        {/* Default task fields — available on every item regardless of
            source, editable inline. */}
        <DefaultFields key={`defaults-${item.id}`} item={item} />

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

/** "Sync this task to Asana" icon — for synced tasks. With automatic sync on
 * it shows as a passive indicator (every edit is pushed and logged on its
 * own); otherwise clicking pushes the task, re-reads it from Asana to confirm,
 * and reports the outcome through `onResult`. Highlighted when the task has
 * local changes that haven't been pushed. */
function AsanaSyncButton({ item, onResult }: { item: BoardItem; onResult: (r: { text: string; ok: boolean } | null) => void }) {
  const { connection } = useAsanaConnection();
  const [busy, setBusy] = useState(false);
  if (item.externalSource !== 'asana') return null;

  if (connection.autoPush) {
    return (
      <span title="Changes are synced to Asana automatically" className="w-7 h-7 flex items-center justify-center text-success">
        <Icon name="sync" size={16} />
      </span>
    );
  }

  async function run() {
    setBusy(true);
    onResult(null);
    try {
      const results = await pushToAsana([item.id]);
      onResult({ text: summarizePush(results), ok: results.every((r) => r.status === 'ok') });
    } catch (e) {
      onResult({ text: e instanceof Error ? e.message : 'Sync to Asana failed.', ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      title={item.dirtySince ? 'Changed here since the last sync — push to Asana' : 'Sync this task to Asana'}
      aria-label="Sync to Asana"
      className={clsx(
        'relative w-7 h-7 rounded-md flex items-center justify-center disabled:opacity-60 hover:bg-[#F4F3F0]',
        item.dirtySince ? 'text-accent' : 'text-label hover:text-body',
      )}
    >
      <Icon name="sync" size={16} className={busy ? 'animate-spin' : undefined} />
      {item.dirtySince && !busy && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />}
    </button>
  );
}

/** Adds a field to the item's hand-edited set so sync/auto-detection stops overwriting it. */
function withLock(item: BoardItem, field: 'type' | 'module'): string[] {
  return [...new Set([...(item.lockedFields ?? []), field])];
}

/** Re-detect Type + Module from the title/body: rules (instant) or Claude (optional, needs the AI backend). */
function DetectBar({ item }: { item: BoardItem }) {
  const updateItem = useUpdateItem();
  const { modules } = useModules();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function runRules() {
    const type = detectType(item.title, item.description);
    const mod = detectModule(item.title, item.description ?? '', modules);
    if (!type && !mod) {
      setMessage('Nothing detected from the title or description.');
      return;
    }
    // Clears the hand-edit lock — re-detecting is an explicit "go back to automatic".
    updateItem(item.id, {
      ...(type ? { type } : {}),
      ...(mod ? { module: mod } : {}),
      lockedFields: (item.lockedFields ?? []).filter((f) => f !== 'type' && f !== 'module'),
    });
    setMessage(`Detected ${[type, mod].filter(Boolean).join(' · ')}.`);
  }

  async function runAi() {
    setBusy(true);
    setMessage(null);
    try {
      const [r] = await classifyItems(
        [{ id: item.id, title: item.title, ...(item.description ? { body: item.description } : {}) }],
        modules.map((m) => m.name),
      );
      if (!r || (!r.type && !r.module)) {
        setMessage('AI found nothing to change.');
        return;
      }
      await updateItem(item.id, {
        ...(r.type ? { type: r.type } : {}),
        ...(r.module ? { module: r.module } : {}),
        lockedFields: [...new Set([...(item.lockedFields ?? []), ...(r.type ? ['type'] : []), ...(r.module ? ['module'] : [])])],
      });
      setMessage(`AI: ${[r.type, r.module].filter(Boolean).join(' · ')}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'AI detection failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-2 text-[12px] text-label flex-wrap">
      <span>Detect type &amp; module:</span>
      <button type="button" onClick={runRules} className="text-accent font-medium hover:opacity-80">From title</button>
      <span>·</span>
      <button type="button" onClick={runAi} disabled={busy} className="text-accent font-medium hover:opacity-80 disabled:opacity-50">
        {busy ? 'Asking AI…' : 'With AI'}
      </button>
      {message && <span className="text-body">{message}</span>}
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
          onChange={(e) =>
            updateItem(item.id, { type: e.target.value as RequestType, lockedFields: withLock(item, 'type') })
          }
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
      <div className="flex flex-col gap-1">
        <Eyebrow>RICE</Eyebrow>
        <button type="button" onClick={() => setShowRice((v) => !v)} className={clsx(fieldInputClass, 'text-left')}>
          {item.riceScore != null ? item.riceScore.toFixed(1) : '—'}
        </button>
      </div>
      {/* Inline (not a popover): the panel scrolls, so an absolutely
          positioned popover could be clipped or hang off-screen. */}
      {showRice && <RicePopover item={item} onClose={() => setShowRice(false)} variant="inline" />}
    </div>
  );
}

/** Estimated time, Customer name, Module, Tags — standard fields on every
 * task regardless of source, editable directly here. Keyed by item.id in
 * the parent so local edit state resets cleanly when the panel switches
 * to a different item instead of carrying stale values over. */
function DefaultFields({ item }: { item: BoardItem }) {
  const updateItem = useUpdateItem();
  const { modules } = useModules();
  const [estimatedHours, setEstimatedHours] = useState(item.estimatedHours != null ? String(item.estimatedHours) : '');
  const [customerName, setCustomerName] = useState(item.customerName ?? '');
  const [tagsText, setTagsText] = useState((item.tags ?? []).join(', '));

  function saveEstimatedHours() {
    const n = estimatedHours.trim() === '' ? null : Number(estimatedHours);
    if (n !== null && Number.isNaN(n)) return;
    updateItem(item.id, { estimatedHours: n });
  }
  function saveCustomerName() {
    updateItem(item.id, { customerName: customerName.trim() || null });
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
        <select
          value={item.module ?? ''}
          onChange={(e) =>
            updateItem(item.id, { module: e.target.value || null, lockedFields: withLock(item, 'module') })
          }
          className={fieldInputClass}
        >
          <option value="">None</option>
          {/* A value synced from Asana that isn't in the catalog yet stays selectable. */}
          {item.module && !modules.some((m) => m.name === item.module) && <option value={item.module}>{item.module}</option>}
          {modules.map((m) => (
            <option key={m.id} value={m.name}>{m.parentId ? '— ' : ''}{m.name}</option>
          ))}
        </select>
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
