import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Eyebrow } from '@/components/ui/Card';
import { Tag, TypeTag, PriorityTag } from '@/components/ui/Tag';
import { Segmented } from '@/components/ui/Segmented';
import { useBoardItems, useItemNotes, useAddNote, useMoveItem } from '@/features/board/hooks';
import type { ItemNote } from '@/features/board/types';

/** Screens 11/12/41 — Developer item detail with internal/external activity + Slack sync. */
export function ItemDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items } = useBoardItems();
  const item = items.find((i) => i.id === id);
  const { notes } = useItemNotes(id);
  const addNote = useAddNote(id);
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
      <>
        <TopNav center={<span className="text-[13px] text-body">Item</span>} />
        <div className="flex-1 flex items-center justify-center bg-canvas text-sm text-body">
          Item not found. <button className="text-accent ml-1" onClick={() => navigate('/board')}>Back to board</button>
        </div>
      </>
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
    <>
      <TopNav
        center={
          <div className="text-[13px] text-label flex items-center gap-2">
            <span>Board</span><span className="text-hairline">/</span>
            <span className="font-mono">{item.ref}</span>
          </div>
        }
        notificationCount={4}
      />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin">
        <div className="max-w-4xl mx-auto px-8 py-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] text-label mb-1">{item.ref}</div>
              <h1 className="text-xl font-semibold tracking-tight">{item.title}</h1>
              <div className="flex items-center gap-2 mt-2">
                <PriorityTag priority={item.priority} />
                <Tag tone="pm">{statusLabel}</Tag>
                {slaLabel(item.createdAt, item.priority, isReleased) && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#9A6410] font-mono">
                    <Icon name="schedule" size={13} /> {slaLabel(item.createdAt, item.priority, isReleased)}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => !isReleased && move(item.id, 'released')}
              disabled={isReleased}
              className="inline-flex items-center gap-1.5 text-[13px] text-success font-medium hover:opacity-80 disabled:opacity-50"
            >
              <Icon name="check" size={16} /> {isReleased ? 'Completed' : 'Mark complete'}
            </button>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-3 gap-x-8 gap-y-5 mt-6 bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame p-5">
            <Meta label="Type" value={<TypeTag type={item.type} />} />
            <Meta label="Priority" value={<PriorityTag priority={item.priority} />} />
            <Meta label="Status" value={statusLabel} />
            <Meta label="Assignee" value={item.assigneeName ?? 'Unassigned'} />
            <Meta label="Created" value={item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'} />
            <Meta label="RICE" value={item.riceScore != null ? item.riceScore.toFixed(1) : '—'} />
          </div>

          {/* Activity — two channels */}
          <div className="mt-7">
            <Eyebrow className="mb-3">Activity</Eyebrow>
            <div className="grid grid-cols-2 gap-6">
              <Channel title="External · customer sees" dot="#1D9E75" notes={external} />
              <Channel title="Internal · team only" dot="#3F3791" notes={internal} />
            </div>
          </div>

          {/* Comment box */}
          <div className="mt-6 bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame p-3">
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
      </div>
    </>
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
