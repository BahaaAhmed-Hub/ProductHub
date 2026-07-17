import { TopNav } from '@/components/layout/TopNav';
import { KPITile } from '@/components/ui/KPITile';
import { PriorityTag } from '@/components/ui/Tag';
import { useBoardItems } from '@/features/board/hooks';
import { useItemPanel } from '@/features/board/panelStore';
import type { BoardStatus, Priority } from '@/types/domain';
import type { BoardItem } from '@/features/board/types';

const STATUS_LABEL: Record<BoardStatus, { label: string; color: string }> = {
  triaged: { label: 'Triaged', color: 'text-body' },
  in_development: { label: 'In Dev', color: 'text-accent' },
  in_qa: { label: 'In QA', color: 'text-[#9A6410]' },
  released: { label: 'Released', color: 'text-success' },
};

const TARGET_H: Record<Priority, number> = { critical: 8, high: 24, medium: 72, low: 120 };

interface Sla { label: string; kind: 'met' | 'ok' | 'risk' | 'breach' }
function slaFor(item: BoardItem): Sla {
  if (item.boardStatus === 'released') return { label: 'Met', kind: 'met' };
  if (!item.createdAt) return { label: '—', kind: 'ok' };
  const target = TARGET_H[item.priority];
  const left = target - (Date.now() - new Date(item.createdAt).getTime()) / 3_600_000;
  const fmt = (h: number) => (h >= 24 ? `${Math.floor(h / 24)}d ${Math.floor(h % 24)}h` : `${Math.floor(h)}h ${Math.floor((h % 1) * 60)}m`);
  if (left <= 0) return { label: `Breached ${fmt(-left)}`, kind: 'breach' };
  if (left <= target * 0.25) return { label: `${fmt(left)} left`, kind: 'risk' };
  return { label: `${fmt(left)} left`, kind: 'ok' };
}

/** Screen 14 — Developer personal SLA view (real, computed from item timestamps). */
export function MySLAScreen() {
  const openItem = useItemPanel((s) => s.open);
  const { items } = useBoardItems();

  const withSla = items.map((item) => ({ item, sla: slaFor(item) }));
  const atRisk = withSla.filter((x) => x.sla.kind === 'risk' || x.sla.kind === 'breach').length;
  const withinSla = withSla.filter((x) => x.sla.kind === 'ok' || x.sla.kind === 'met').length;
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
          <KPITile label="Within SLA" value={withinSla} />
          <KPITile label="At risk" value={atRisk} />
          <KPITile label="Resolved" value={resolvedToday} />
        </div>

        <div className="mt-5 bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame overflow-hidden">
          <div className="grid grid-cols-[92px_1fr_110px_100px_130px] gap-3 px-4 py-2.5 text-eyebrow font-medium uppercase text-label border-b-[0.5px] border-hairline">
            <span>Ref</span><span>Title</span><span>Status</span><span>Priority</span>
            <span className="text-right">SLA</span>
          </div>
          {items.length === 0 && <div className="py-10 text-center text-sm text-body">No assigned items yet.</div>}
          {withSla.map(({ item, sla }) => {
            const st = STATUS_LABEL[item.boardStatus];
            return (
              <div
                key={item.id}
                onClick={() => openItem(item.id)}
                className="grid grid-cols-[92px_1fr_110px_100px_130px] gap-3 items-center px-4 h-12 border-b-[0.5px] border-hairline last:border-0 cursor-pointer hover:bg-[#F7F7F5]"
              >
                <span className="font-mono text-[11px] text-label">{item.ref}</span>
                <span className="text-[13px] font-medium truncate">{item.title}</span>
                <span className={`text-[12px] font-medium ${st.color}`}>● {st.label}</span>
                <span><PriorityTag priority={item.priority} /></span>
                <span className={`text-[12px] text-right font-mono ${sla.kind === 'breach' ? 'text-danger font-semibold' : sla.kind === 'risk' ? 'text-[#9A6410]' : 'text-body'}`}>
                  {sla.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
