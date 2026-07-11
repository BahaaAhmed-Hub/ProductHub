import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Eyebrow } from '@/components/ui/Card';
import { Tag, TypeTag, PriorityTag } from '@/components/ui/Tag';
import { Segmented } from '@/components/ui/Segmented';
import { useBoardItems } from '@/features/board/hooks';

interface Note {
  author: string;
  initials: string;
  ago: string;
  body: string;
  internal: boolean;
}

const SAMPLE_NOTES: Note[] = [
  {
    author: 'Maya T.',
    initials: 'MT',
    ago: '2d ago',
    internal: false,
    body: "Seeing 429s on the enterprise plan even though we're well under quota. Started after the Tuesday deploy.",
  },
  {
    author: 'Sara K.',
    initials: 'SK',
    ago: '4h ago',
    internal: true,
    body: "Confirmed — the limiter isn't reading the tier override flag. Patch in progress, targeting today's QA build.",
  },
  {
    author: 'Ahmed R.',
    initials: 'AR',
    ago: '2h ago',
    internal: true,
    body: 'Root cause is in the gateway config refactor — linking that PR here.',
  },
];

/** Screens 11/12/41 — Developer item detail with internal/external activity + Slack sync. */
export function ItemDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items } = useBoardItems();
  const item = items.find((i) => i.id === id);
  const [channel, setChannel] = useState<'internal' | 'external'>('internal');
  const [comment, setComment] = useState('');

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
  const external = SAMPLE_NOTES.filter((n) => !n.internal);
  const internal = SAMPLE_NOTES.filter((n) => n.internal);

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
                <span className="inline-flex items-center gap-1 text-[11px] text-[#9A6410] font-mono">
                  <Icon name="schedule" size={13} /> 0h 47m · SLA
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-[#3F3791]">
                  <Icon name="bolt" size={13} /> Synced to Slack
                </span>
              </div>
            </div>
            <button className="inline-flex items-center gap-1.5 text-[13px] text-success font-medium hover:opacity-80">
              <Icon name="check" size={16} /> Mark complete
            </button>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-3 gap-x-8 gap-y-5 mt-6 bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame p-5">
            <Meta label="Customer" value="Orion Cloud" />
            <Meta label="Reporter" value="Maya T." />
            <Meta label="Created" value="Jun 11, 2026" />
            <Meta label="Assignee" value={item.assigneeName ?? 'Unassigned'} />
            <Meta label="Type" value={<TypeTag type={item.type} />} />
            <Meta label="Branch" value={<span className="font-mono text-[12px] text-accent">fix/tier-limiter</span>} />
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
                disabled={!comment.trim()}
                className="h-8 px-4 rounded-control bg-navy text-white text-[13px] font-medium disabled:opacity-40 hover:bg-[#152238]"
              >
                Send
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

function Channel({ title, dot, notes }: { title: string; dot: string; notes: Note[] }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
        <span className="text-[11px] font-medium text-label">{title}</span>
      </div>
      <div className="flex flex-col gap-3">
        {notes.map((n, i) => (
          <div key={i} className="flex gap-2.5">
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
