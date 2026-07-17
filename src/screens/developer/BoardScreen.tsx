import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { TopNav } from '@/components/layout/TopNav';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { TypeTag, PriorityTag } from '@/components/ui/Tag';
import { NewItemDialog } from '@/components/board/NewItemDialog';
import { BOARD_COLUMNS, type BoardItem } from '@/features/board/types';
import { useBoardItems, useMoveItem } from '@/features/board/hooks';
import type { BoardStatus } from '@/types/domain';

/** Screen 10 — Developer kanban board with native drag-and-drop. */
export function BoardScreen() {
  const navigate = useNavigate();
  const { items, isLoading } = useBoardItems();
  const move = useMoveItem();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<BoardStatus | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);

  const done = items.filter((i) => i.boardStatus === 'released').length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  async function onDrop(status: BoardStatus) {
    if (dragId) await move(dragId, status);
    setDragId(null);
    setOverCol(null);
  }

  return (
    <>
      <TopNav
        center={
          <div className="text-[13px] text-label flex items-center gap-2">
            <span>Sprint 24</span>
            <span className="text-hairline">/</span>
            <span className="text-body font-medium">Board</span>
          </div>
        }
        actions={
          <Button variant="secondary" icon="add" onClick={() => setShowNewItem(true)}>
            New item
          </Button>
        }
        notificationCount={4}
      />

      <div className="flex-1 bg-canvas p-4 flex flex-col gap-3 min-h-0 overflow-hidden">
        {/* Sprint summary */}
        <div className="bg-surface border-[0.5px] border-hairline rounded-xl shadow-frame px-4 py-3 flex items-center gap-6 flex-shrink-0">
          <div className="w-36">
            <div className="text-sm font-semibold">Sprint 24</div>
            <div className="text-xs text-label font-mono">Jun 9 – Jun 23</div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-xs text-body">Completion</span>
              <span className="text-xs text-body">
                <b className="text-ink font-semibold">{done}</b> / {items.length} items
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#ECEBE7] overflow-hidden">
              <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Columns */}
        <div className="flex-1 flex gap-3 min-h-0">
          {BOARD_COLUMNS.map((col) => {
            const colItems = items.filter((i) => i.boardStatus === col.status);
            return (
              <div
                key={col.status}
                className="flex-1 flex flex-col gap-2 min-w-0 border-[0.5px] border-hairline rounded-frame bg-surface/50 p-2"
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col.status);
                }}
                onDrop={() => onDrop(col.status)}
              >
                <div className="flex items-center gap-2 px-0.5 pb-0.5">
                  <span className="w-[7px] h-[7px] rounded-full" style={{ background: col.dot }} />
                  <span className="text-xs font-semibold">{col.label}</span>
                  <span className="min-w-4 h-[15px] px-1.5 rounded-full bg-[#EFEEE9] text-[#5F5E57] text-[10px] font-semibold flex items-center justify-center">
                    {colItems.length}
                  </span>
                </div>
                <div
                  className={clsx(
                    'flex-1 flex flex-col gap-2 rounded-lg p-1 -m-1 transition-colors overflow-y-auto scroll-thin',
                    overCol === col.status && dragId ? 'bg-accent-bg/60' : '',
                  )}
                >
                  {colItems.map((item) => (
                    <BoardCard
                      key={item.id}
                      item={item}
                      onDragStart={() => setDragId(item.id)}
                      onDragEnd={() => setDragId(null)}
                      onOpen={() => navigate(`/items/${item.id}`)}
                    />
                  ))}
                  {isLoading && <div className="text-xs text-label px-1 py-2">Loading…</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {showNewItem && <NewItemDialog onClose={() => setShowNewItem(false)} />}
    </>
  );
}

function BoardCard({
  item,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  item: BoardItem;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  const critical = item.priority === 'critical';
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={clsx(
        'bg-surface border-[0.5px] border-hairline rounded-[10px] p-2.5 flex flex-col gap-1.5 cursor-grab active:cursor-grabbing hover:shadow-frame',
        critical && 'border-l-2 border-l-danger',
      )}
    >
      <div className="flex justify-between items-center">
        <span className="font-mono text-[10px] text-label">{item.ref}</span>
        <TypeTag type={item.type} />
      </div>
      <div className="text-xs font-medium leading-snug">{item.title}</div>
      <div className="flex justify-between items-center">
        <PriorityTag priority={item.priority} />
        {item.assigneeInitials ? (
          <Avatar
            initials={item.assigneeInitials}
            size={20}
            tone={critical ? 'accent' : 'success'}
          />
        ) : (
          <span className="w-5 h-5 rounded-full border border-dashed border-hairline" />
        )}
      </div>
    </div>
  );
}
