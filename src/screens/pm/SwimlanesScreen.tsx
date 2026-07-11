import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { TopNav } from '@/components/layout/TopNav';
import { PriorityTag } from '@/components/ui/Tag';
import { BOARD_COLUMNS } from '@/features/board/types';
import { useBoardItems, useMoveItem } from '@/features/board/hooks';
import type { BoardStatus } from '@/types/domain';

/** Screen 23 — board grouped into swimlanes (real). Drag cards to change status. */
export function SwimlanesScreen() {
  const navigate = useNavigate();
  const { items } = useBoardItems();
  const move = useMoveItem();
  const [dragId, setDragId] = useState<string | null>(null);

  const lanes = Array.from(new Set(items.map((i) => i.swimlane ?? 'Unassigned'))).sort();

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Swimlanes</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-auto scroll-thin p-4">
        {/* column headers */}
        <div className="grid grid-cols-[140px_repeat(4,1fr)] gap-2 mb-2 sticky top-0">
          <span />
          {BOARD_COLUMNS.map((c) => (
            <div key={c.status} className="flex items-center gap-2 px-1">
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: c.dot }} />
              <span className="text-xs font-semibold">{c.label}</span>
            </div>
          ))}
        </div>

        {lanes.map((lane) => (
          <div key={lane} className="grid grid-cols-[140px_repeat(4,1fr)] gap-2 mb-2">
            <div className="flex items-center px-2 py-3">
              <span className="text-[13px] font-semibold text-body">{lane}</span>
            </div>
            {BOARD_COLUMNS.map((col) => {
              const cells = items.filter((i) => (i.swimlane ?? 'Unassigned') === lane && i.boardStatus === col.status);
              return (
                <div
                  key={col.status}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragId) move(dragId, col.status as BoardStatus); setDragId(null); }}
                  className="min-h-[60px] rounded-lg bg-surface/60 border-[0.5px] border-hairline p-1.5 flex flex-col gap-1.5"
                >
                  {cells.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDragId(item.id)}
                      onClick={() => navigate(`/items/${item.id}`)}
                      className={clsx('bg-surface border-[0.5px] border-hairline rounded-[8px] p-2 flex flex-col gap-1 cursor-grab active:cursor-grabbing', item.priority === 'critical' && 'border-l-2 border-l-danger')}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-label">{item.ref}</span>
                        <PriorityTag priority={item.priority} />
                      </div>
                      <div className="text-[11px] font-medium leading-snug line-clamp-2">{item.title}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
        {lanes.length === 0 && <div className="text-sm text-body p-4">No items yet — add backlog items to see swimlanes.</div>}
      </div>
    </>
  );
}
