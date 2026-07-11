import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import clsx from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Tag, TypeTag, PriorityTag } from '@/components/ui/Tag';
import { useRequest } from '@/features/requests/hooks';
import type { CustomerStatus } from '@/features/requests/types';

const STEPS: { key: string; label: string }[] = [
  { key: 'received', label: 'Received' },
  { key: 'triaged', label: 'Triaged' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'confirmed', label: 'Confirmed by customer' },
];

const CURRENT_INDEX: Record<CustomerStatus, number> = {
  received: 0,
  in_progress: 2,
  resolved: 3,
};

export function RequestDetailScreen() {
  const { id } = useParams();
  const request = useRequest(id);
  const [reply, setReply] = useState('');

  if (!request) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-16 text-center">
        <p className="text-body">Request not found.</p>
        <Link to="/requests" className="text-accent text-sm">
          Back to my requests
        </Link>
      </div>
    );
  }

  const current = CURRENT_INDEX[request.status];

  return (
    <div className="max-w-4xl mx-auto px-8 py-10 flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <h1 className="text-xl font-semibold tracking-tight">{request.subject}</h1>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 text-[13px] text-accent font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            {request.status === 'in_progress'
              ? 'In progress'
              : request.status === 'resolved'
                ? 'Resolved'
                : 'Received'}
          </span>
          {request.slaLeft && (
            <span className="inline-flex items-center gap-1 text-[12px] text-danger font-medium">
              <Icon name="local_fire_department" size={14} /> SLA · {request.slaLeft}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span className="font-mono text-[11px] text-label">{request.ref}</span>
        <TypeTag type={request.type} />
        <PriorityTag priority={request.priority} />
        {request.plannedRelease && <Tag tone="accent">Planned · {request.plannedRelease}</Tag>}
      </div>

      {/* Timeline */}
      <div className="mt-6 rounded-frame border-[0.5px] border-hairline bg-surface shadow-frame px-6 py-5">
        <div className="flex items-start">
          {STEPS.map((s, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <div key={s.key} className="flex-1 flex flex-col items-center relative">
                {i < STEPS.length - 1 && (
                  <span
                    className={clsx(
                      'absolute top-[11px] left-1/2 w-full h-[2px]',
                      done ? 'bg-success' : 'bg-hairline',
                    )}
                  />
                )}
                <span
                  className={clsx(
                    'relative z-10 w-[22px] h-[22px] rounded-full flex items-center justify-center',
                    done && 'bg-success text-white',
                    active && 'bg-accent text-white',
                    !done && !active && 'bg-canvas border-[0.5px] border-hairline text-label',
                  )}
                >
                  {done ? (
                    <Icon name="check" size={13} />
                  ) : active ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-label/50" />
                  )}
                </span>
                <span className="text-[11px] font-medium mt-2 text-center leading-tight">
                  {s.label}
                </span>
                <span className="text-[10px] text-label mt-0.5">
                  {done ? '3d ago' : active ? 'now' : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversation */}
      <div className="mt-7 flex-1">
        <div className="text-eyebrow font-medium uppercase text-label mb-3">Conversation</div>
        <div className="flex flex-col gap-5">
          {request.conversation.map((c, i) => (
            <div key={i} className="flex gap-3">
              <Avatar initials={c.initials} tone={c.isTeam ? 'accent' : 'neutral'} size={26} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium">{c.authorName}</span>
                  {c.isTeam && <Tag tone="accent">ProductHub team</Tag>}
                  <span className="text-[11px] text-label">{c.timeAgo}</span>
                </div>
                <p className="text-[13px] text-body leading-relaxed mt-1">{c.body}</p>
                {c.attachment && (
                  <div className="inline-flex items-center gap-2 mt-2 h-9 px-3 rounded-control border-[0.5px] border-hairline bg-surface">
                    <Icon name="description" size={15} className="text-label" />
                    <span className="text-[12px]">{c.attachment.name}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reply box */}
      <div className="mt-6 rounded-frame border-[0.5px] border-hairline bg-surface shadow-frame p-3">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Add a reply…"
          className="w-full text-[13px] outline-none px-1 py-1"
        />
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-4 text-[12px] text-label">
            <button className="inline-flex items-center gap-1 hover:text-body">
              <Icon name="attach_file" size={15} /> Attach
            </button>
            <button className="inline-flex items-center gap-1 hover:text-body">
              <Icon name="mic" size={15} /> Voice to text
            </button>
          </div>
          <button
            disabled={!reply.trim()}
            className="h-8 px-4 rounded-control bg-navy text-white text-[13px] font-medium disabled:opacity-40 hover:bg-[#152238]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
