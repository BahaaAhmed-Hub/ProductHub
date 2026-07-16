import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { useBoardItems, useMoveItem, useAddNote } from '@/features/board/hooks';

/** Screen 13 — Developer QA & release. Picks the next in-QA item; releasing is real. */
export function QAReleaseScreen() {
  const navigate = useNavigate();
  const { items } = useBoardItems();
  const move = useMoveItem();
  const item = items.find((i) => i.boardStatus === 'in_qa') ?? items.find((i) => i.boardStatus !== 'released');
  const addNote = useAddNote(item?.id);
  const [notes, setNotes] = useState('');
  const [releasing, setReleasing] = useState(false);

  async function release() {
    if (!item) return;
    setReleasing(true);
    try {
      if (notes.trim()) await addNote(notes.trim(), false); // external release note
      await move(item.id, 'released');
      navigate(`/items/${item.id}`);
    } finally {
      setReleasing(false);
    }
  }

  if (!item) {
    return (
      <>
        <TopNav center={<span className="text-[13px] text-body">Release</span>} notificationCount={4} />
        <div className="flex-1 flex items-center justify-center bg-canvas text-sm text-body">
          Nothing in QA to release. <button className="text-accent ml-1" onClick={() => navigate('/board')}>Back to board</button>
        </div>
      </>
    );
  }

  const checks = [
    { label: `${item.ref} is in QA`, detail: '', done: item.boardStatus === 'in_qa' },
    { label: 'Release notes for the customer', detail: notes.trim() ? 'Ready' : 'Required below', done: notes.trim().length > 0 },
  ];

  return (
    <>
      <TopNav
        center={
          <div className="text-[13px] text-label flex items-center gap-2">
            <span>Board</span><span className="text-hairline">/</span>
            <span className="font-mono">{item.ref}</span><span className="text-hairline">/</span>
            <span className="text-body font-medium">Release</span>
          </div>
        }
        notificationCount={4}
      />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin">
        <div className="max-w-2xl mx-auto px-8 py-8">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-label">{item.ref}</span>
            <Tag tone={item.boardStatus === 'in_qa' ? 'success' : 'neutral'}>{item.boardStatus === 'in_qa' ? 'In QA' : 'Ready'}</Tag>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Release “{item.title}”</h1>

          <div className="mt-6 bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame divide-y divide-hairline">
            {checks.map((c) => (
              <div key={c.label} className="flex items-center gap-3 px-4 py-3.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${c.done ? 'bg-success-bg text-success' : 'bg-[#FBF0DD] text-[#9A6410]'}`}>
                  <Icon name={c.done ? 'check' : 'error'} size={13} />
                </span>
                <span className="text-[13px] flex-1">{c.label}</span>
                {c.detail && <span className={`text-[12px] ${c.done ? 'text-body' : 'text-[#9A6410] font-medium'}`}>{c.detail}</span>}
              </div>
            ))}
          </div>

          <div className="mt-5">
            <Eyebrow className="mb-2">Release notes (posted to the customer thread)</Eyebrow>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What shipped and what it fixes…"
              className="w-full px-3 py-2.5 rounded-control border-[0.5px] border-hairline bg-surface text-[13px] outline-none focus:border-accent resize-none"
            />
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate(`/items/${item.id}`)}>Cancel</Button>
            <Button
              variant="primary" icon="bolt" disabled={releasing}
              className="bg-success hover:bg-[#178a63]"
              onClick={release}
            >
              {releasing ? 'Releasing…' : 'Release & resolve'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
