import { useState } from 'react';
import clsx from 'clsx';
import { TopNav } from '@/components/layout/TopNav';
import { TypeTag } from '@/components/ui/Tag';
import { useBoardItems, useUpdateItem } from '@/features/board/hooks';
import type { BoardItem } from '@/features/board/types';
import type { Priority } from '@/types/domain';

type Bucket = 'must' | 'should' | 'could' | 'wont';
const COLS: { key: Bucket; label: string; color: string }[] = [
  { key: 'must', label: 'Must have', color: '#B23230' },
  { key: 'should', label: 'Should have', color: '#D97706' },
  { key: 'could', label: 'Could have', color: '#2367A9' },
  { key: 'wont', label: "Won't (this time)", color: '#8A8983' },
];

const seedBucket = (p: Priority): Bucket =>
  p === 'critical' ? 'must' : p === 'high' ? 'should' : p === 'medium' ? 'could' : 'wont';

// Bucket comes from persisted score_inputs.moscow, falling back to priority seed.
const bucketOf = (i: BoardItem): Bucket => ((i.scoreInputs?.moscow as Bucket) ?? seedBucket(i.priority));

/** Screen 53 — MoSCoW prioritization board (real, persisted to score_inputs.moscow). */
export function MoscowScreen() {
  const { items } = useBoardItems();
  const update = useUpdateItem();
  const [dragId, setDragId] = useState<string | null>(null);

  async function assignTo(item: BoardItem, bucket: Bucket) {
    if (bucketOf(item) === bucket) return;
    await update(item.id, { scoreInputs: { ...(item.scoreInputs ?? {}), moscow: bucket } });
  }

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">MoSCoW</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-hidden p-6 flex flex-col">
        <h1 className="text-lg font-semibold tracking-tight mb-4">MoSCoW · Q4 scope</h1>
        <div className="flex-1 grid grid-cols-4 gap-3 min-h-0">
          {COLS.map((col) => {
            const colItems = items.filter((i) => bucketOf(i) === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const it = items.find((i) => i.id === dragId);
                  if (it) assignTo(it, col.key);
                  setDragId(null);
                }}
                className="flex flex-col min-h-0"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                  <span className="text-[13px] font-semibold">{col.label}</span>
                  <span className="text-[11px] text-label">{colItems.length}</span>
                </div>
                <div className="flex-1 flex flex-col gap-2 overflow-y-auto scroll-thin rounded-lg bg-[#F2F1EE]/50 p-2">
                  {colItems.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDragId(item.id)}
                      className={clsx(
                        'bg-surface border-[0.5px] border-hairline rounded-[10px] p-2.5 flex flex-col gap-1.5 cursor-grab active:cursor-grabbing',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-label">{item.ref}</span>
                        <TypeTag type={item.type} />
                      </div>
                      <div className="text-xs font-medium leading-snug">{item.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
