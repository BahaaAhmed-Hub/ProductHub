import { useNavigate } from 'react-router-dom';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { TypeTag } from '@/components/ui/Tag';
import { useBoardItems } from '@/features/board/hooks';
import { useItemPanel } from '@/features/board/panelStore';
import type { BoardItem } from '@/features/board/types';

function rankBy(items: BoardItem[], get: (i: BoardItem) => number): Map<string, number> {
  const sorted = [...items].sort((a, b) => get(b) - get(a));
  return new Map(sorted.map((i, idx) => [i.id, idx + 1]));
}

/** Screen 56 — prioritization results: blended rank across RICE + WSJF. */
export function ResultsScreen() {
  const openItem = useItemPanel((s) => s.open);
  const navigate = useNavigate();
  const { items, isLoading } = useBoardItems();

  const riceRank = rankBy(items, (i) => i.riceScore ?? 0);
  const wsjfRank = rankBy(items, (i) => i.wsjfScore ?? 0);
  const rows = items
    .map((item) => {
      const rr = riceRank.get(item.id) ?? items.length;
      const wr = wsjfRank.get(item.id) ?? items.length;
      return { item, rr, wr, blended: (rr + wr) / 2 };
    })
    .sort((a, b) => a.blended - b.blended);

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Results</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <button onClick={() => navigate('/prioritize')} className="text-[13px] text-accent mb-3 inline-flex items-center gap-1">
          <Icon name="expand_more" size={16} className="rotate-90" /> Prioritization
        </button>
        <h1 className="text-lg font-semibold tracking-tight mb-1">Prioritization results</h1>
        <p className="text-xs text-label mb-4">Blended ranking across RICE and WSJF from your scored backlog.</p>

        {isLoading ? (
          <div className="text-sm text-body">Loading…</div>
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-body">Score items in RICE and WSJF to see the ranked output.</p>
        ) : (
          <div className="bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame overflow-hidden max-w-4xl">
            <div className="grid grid-cols-[50px_92px_1fr_84px_80px_80px_80px] gap-2 px-4 py-2.5 text-eyebrow font-medium uppercase text-label border-b-[0.5px] border-hairline">
              <span>Rank</span><span>Ref</span><span>Title</span><span>Type</span>
              <span className="text-right">RICE #</span><span className="text-right">WSJF #</span><span className="text-right">Blend</span>
            </div>
            {rows.map(({ item, rr, wr, blended }, idx) => (
              <div
                key={item.id}
                onClick={() => openItem(item.id)}
                className="grid grid-cols-[50px_92px_1fr_84px_80px_80px_80px] gap-2 items-center px-4 h-12 border-b-[0.5px] border-hairline last:border-0 cursor-pointer hover:bg-[#F7F7F5]"
              >
                <span className={`text-[15px] font-semibold ${idx === 0 ? 'text-success' : 'text-ink'}`}>{idx + 1}</span>
                <span className="font-mono text-[11px] text-label">{item.ref}</span>
                <span className="text-[13px] font-medium truncate">{item.title}</span>
                <span><TypeTag type={item.type} /></span>
                <span className="text-[12px] text-right font-mono text-body">{rr}</span>
                <span className="text-[12px] text-right font-mono text-body">{wr}</span>
                <span className="text-[13px] text-right font-mono font-semibold text-pm">{blended.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
