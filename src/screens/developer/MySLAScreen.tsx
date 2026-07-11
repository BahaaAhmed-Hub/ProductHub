import { useNavigate } from 'react-router-dom';
import { TopNav } from '@/components/layout/TopNav';
import { KPITile } from '@/components/ui/KPITile';
import { PriorityTag } from '@/components/ui/Tag';
import { useBoardItems } from '@/features/board/hooks';
import type { BoardStatus } from '@/types/domain';

const STATUS_LABEL: Record<BoardStatus, { label: string; color: string }> = {
  triaged: { label: 'Triaged', color: 'text-body' },
  in_development: { label: 'In Dev', color: 'text-accent' },
  in_qa: { label: 'In QA', color: 'text-[#9A6410]' },
  released: { label: 'Released', color: 'text-success' },
};

// Illustrative SLA state per item (real SLA timers land with the SLA engine).
const SLA_STATE = ['Met · 47m spare', '4h 12m left', 'Breached', '1d 6h left', 'Met'];

/** Screen 14 — Developer personal SLA view. */
export function MySLAScreen() {
  const navigate = useNavigate();
  const { items } = useBoardItems();

  const atRisk = SLA_STATE.filter((s) => s.includes('left') || s === 'Breached').length;
  const resolvedToday = items.filter((i) => i.boardStatus === 'released').length;

  return (
    <>
      <TopNav
        center={
          <div className="text-[13px] text-label flex items-center gap-2">
            <span>Sprint 24</span><span className="text-hairline">/</span>
            <span className="text-body font-medium">My Items</span>
          </div>
        }
        notificationCount={4}
      />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <div className="grid grid-cols-4 gap-3">
          <KPITile label="Assigned to me" value={items.length} />
          <KPITile label="Within SLA" value={Math.max(0, items.length - 1)} />
          <KPITile label="At risk" value={atRisk} />
          <KPITile label="Resolved today" value={resolvedToday} />
        </div>

        <div className="mt-5 bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame overflow-hidden">
          <div className="grid grid-cols-[92px_1fr_110px_100px_120px_130px] gap-3 px-4 py-2.5 text-eyebrow font-medium uppercase text-label border-b-[0.5px] border-hairline">
            <span>Ref</span><span>Title</span><span>Status</span><span>Priority</span>
            <span>Customer</span><span className="text-right">SLA</span>
          </div>
          {items.map((item, idx) => {
            const st = STATUS_LABEL[item.boardStatus];
            const sla = SLA_STATE[idx % SLA_STATE.length]!;
            const breached = sla === 'Breached';
            return (
              <div
                key={item.id}
                onClick={() => navigate(`/items/${item.id}`)}
                className="grid grid-cols-[92px_1fr_110px_100px_120px_130px] gap-3 items-center px-4 h-12 border-b-[0.5px] border-hairline last:border-0 cursor-pointer hover:bg-[#F7F7F5]"
              >
                <span className="font-mono text-[11px] text-label">{item.ref}</span>
                <span className="text-[13px] font-medium truncate">{item.title}</span>
                <span className={`text-[12px] font-medium ${st.color}`}>● {st.label}</span>
                <span><PriorityTag priority={item.priority} /></span>
                <span className="text-[12px] text-body">Orion Cloud</span>
                <span className={`text-[12px] text-right font-mono ${breached ? 'text-danger font-semibold' : 'text-body'}`}>
                  {sla}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
