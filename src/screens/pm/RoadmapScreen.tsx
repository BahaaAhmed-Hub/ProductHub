import { useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Tag } from '@/components/ui/Tag';
import { BUCKETS, useRoadmap, useRoadmapActions, type Bucket, type RoadmapCard } from '@/features/roadmap';

/** Screen 18 — PM roadmap (Now / Next / Later), editable + publishable. */
export function RoadmapScreen() {
  const { cards } = useRoadmap();
  const actions = useRoadmapActions();
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Roadmap</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Roadmap</h1>
            <p className="text-xs text-label mt-0.5">Drag between columns · toggle publish to share on the public roadmap</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {BUCKETS.map((b) => (
            <div
              key={b.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) actions.move(dragId, b.key);
                setDragId(null);
              }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: b.dot }} />
                <span className="text-[13px] font-semibold">{b.label}</span>
                <span className="text-[12px] text-label">{b.sub}</span>
              </div>
              {cards
                .filter((c) => c.bucket === b.key)
                .map((c) => (
                  <RoadmapCardView
                    key={c.id}
                    card={c}
                    onDragStart={() => setDragId(c.id)}
                    onTogglePublish={() => actions.togglePublish(c.id, c.isPublished)}
                  />
                ))}
              <AddCard bucket={b.key} onAdd={(t) => actions.add(t, b.key)} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function RoadmapCardView({
  card,
  onDragStart,
  onTogglePublish,
}: {
  card: RoadmapCard;
  onDragStart: () => void;
  onTogglePublish: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame px-4 py-3 cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[14px] font-semibold leading-snug">{card.title}</div>
        <button onClick={onTogglePublish} title={card.isPublished ? 'Published' : 'Draft'}>
          <Icon
            name={card.isPublished ? 'visibility' : 'visibility_off'}
            size={16}
            className={card.isPublished ? 'text-success' : 'text-label'}
          />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {card.theme && <Tag tone="pm">{card.theme}</Tag>}
        {card.isPublished ? (
          <Tag tone="success">Published</Tag>
        ) : (
          <Tag tone="neutral">Draft</Tag>
        )}
      </div>
    </div>
  );
}

function AddCard({ bucket, onAdd }: { bucket: Bucket; onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-frame border border-dashed border-hairline px-4 py-2.5 text-[13px] text-label hover:bg-[#F4F3F0]"
      >
        <Icon name="add" size={16} /> Add to {bucket}
      </button>
    );
  }
  return (
    <div className="bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame p-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) {
            onAdd(title.trim());
            setTitle('');
            setOpen(false);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Roadmap item…"
        className="w-full text-[13px] outline-none"
      />
      <div className="flex justify-end gap-2 mt-2">
        <button className="text-[12px] text-label" onClick={() => setOpen(false)}>Cancel</button>
        <button
          className="text-[12px] font-medium text-accent disabled:opacity-40"
          disabled={!title.trim()}
          onClick={() => {
            onAdd(title.trim());
            setTitle('');
            setOpen(false);
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
