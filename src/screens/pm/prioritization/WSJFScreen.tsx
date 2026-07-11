import { useNavigate } from 'react-router-dom';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { useBoardItems, useUpdateItem } from '@/features/board/hooks';
import type { BoardItem } from '@/features/board/types';

interface WsjfInput { value: number; time: number; risk: number; size: number }

function inputsOf(item: BoardItem): WsjfInput {
  const w = (item.scoreInputs?.wsjf ?? {}) as Partial<WsjfInput>;
  return { value: w.value ?? 5, time: w.time ?? 5, risk: w.risk ?? 5, size: w.size ?? item.effort ?? 3 };
}
const wsjfOf = (i: WsjfInput) => (i.size ? (i.value + i.time + i.risk) / i.size : 0);

/** Screen 52 — WSJF scoring (real, persisted). (Value + Time + Risk) ÷ Job size. */
export function WSJFScreen() {
  const navigate = useNavigate();
  const { items, isLoading } = useBoardItems();
  const update = useUpdateItem();

  const rows = [...items]
    .map((item) => ({ item, inp: inputsOf(item) }))
    .sort((a, b) => wsjfOf(b.inp) - wsjfOf(a.inp));

  async function setField(item: BoardItem, key: keyof WsjfInput, v: number) {
    const inp = { ...inputsOf(item), [key]: v };
    const score = Number(wsjfOf(inp).toFixed(1));
    await update(item.id, {
      wsjfScore: score,
      scoreInputs: { ...(item.scoreInputs ?? {}), wsjf: inp },
    });
  }

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">WSJF</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <button onClick={() => navigate('/prioritize')} className="text-[13px] text-accent mb-3 inline-flex items-center gap-1">
          <Icon name="expand_more" size={16} className="rotate-90" /> Prioritization
        </button>
        <h1 className="text-lg font-semibold tracking-tight mb-1">WSJF · Weighted Shortest Job First</h1>
        <p className="text-xs text-label mb-4">Edit the inputs — scores compute and save live, ranked by WSJF.</p>

        {isLoading ? (
          <div className="text-sm text-body">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState onGo={() => navigate('/backlog')} />
        ) : (
          <div className="bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame overflow-hidden max-w-4xl">
            <div className="grid grid-cols-[80px_1fr_66px_66px_66px_66px_72px] gap-2 px-4 py-2.5 text-eyebrow font-medium uppercase text-label border-b-[0.5px] border-hairline">
              <span>Ref</span><span>Title</span><span className="text-center">Value</span>
              <span className="text-center">Time</span><span className="text-center">Risk</span>
              <span className="text-center">Size</span><span className="text-right">WSJF</span>
            </div>
            {rows.map(({ item, inp }, idx) => (
              <div key={item.id} className="grid grid-cols-[80px_1fr_66px_66px_66px_66px_72px] gap-2 items-center px-4 h-12 border-b-[0.5px] border-hairline last:border-0">
                <span className="font-mono text-[11px] text-label">{item.ref}</span>
                <span className="text-[13px] font-medium truncate">{item.title}</span>
                {(['value', 'time', 'risk', 'size'] as const).map((k) => (
                  <input
                    key={k}
                    type="number"
                    min={k === 'size' ? 1 : 0}
                    value={inp[k]}
                    onChange={(e) => setField(item, k, Number(e.target.value))}
                    className="h-7 w-14 mx-auto text-center rounded-md border-[0.5px] border-hairline text-[12px] font-mono outline-none focus:border-accent"
                  />
                ))}
                <span className={`text-[13px] text-right font-mono font-semibold ${idx === 0 ? 'text-success' : 'text-pm'}`}>
                  {wsjfOf(inp).toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function EmptyState({ onGo }: { onGo: () => void }) {
  return (
    <div className="max-w-md rounded-frame border border-dashed border-hairline p-8 text-center">
      <div className="text-sm font-medium">No backlog items yet</div>
      <p className="text-[13px] text-body mt-1">
        Add items to the backlog (triage a customer request, or use “Load sample data” on the dashboard) to score them.
      </p>
      <button onClick={onGo} className="text-accent text-[13px] mt-3">Go to backlog →</button>
    </div>
  );
}
