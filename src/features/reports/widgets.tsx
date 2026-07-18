import { Icon } from '@/components/ui/Icon';
import { useBoardItems } from '@/features/board/hooks';
import type { BoardItem } from '@/features/board/types';
import type { WidgetKind } from './index';

function tally<T extends string>(items: BoardItem[], key: (i: BoardItem) => T): { label: T; n: number }[] {
  const m = new Map<T, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
}

function BarList({ data }: { data: { label: string; n: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  if (data.length === 0) return <p className="text-[13px] text-body">No data.</p>;
  return (
    <div className="flex flex-col gap-1.5 overflow-y-auto scroll-thin flex-1 min-h-0">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 py-1">
          <span className="text-[12px] w-24 flex-shrink-0 capitalize text-body truncate">{d.label.replace(/_/g, ' ')}</span>
          <div className="flex-1 h-2 rounded-full bg-[#ECEBE7] overflow-hidden">
            <div className="h-full bg-pm rounded-full" style={{ width: `${(d.n / max) * 100}%` }} />
          </div>
          <span className="text-[12px] font-mono w-6 text-right flex-shrink-0">{d.n}</span>
        </div>
      ))}
    </div>
  );
}

const SLA_TARGET_H: Record<string, number> = { critical: 8, high: 24, medium: 72, low: 120 };
function isBreached(item: BoardItem): boolean {
  if (item.boardStatus === 'released' || !item.createdAt) return false;
  const target = SLA_TARGET_H[item.priority] ?? 72;
  const elapsed = (Date.now() - new Date(item.createdAt).getTime()) / 3_600_000;
  return elapsed > target;
}

/** Renders the right content for a widget kind — the library WIDGET_LIBRARY
 * offers, computed straight from the board items already in cache (no
 * extra fetch per widget). */
export function WidgetContent({ kind }: { kind: WidgetKind }) {
  const { items } = useBoardItems();

  if (kind === 'by_type') return <BarList data={tally(items, (i) => i.type)} />;
  if (kind === 'by_status') return <BarList data={tally(items, (i) => i.boardStatus)} />;
  if (kind === 'by_priority') return <BarList data={tally(items, (i) => i.priority)} />;

  if (kind === 'team_workload') {
    return <BarList data={tally(items.filter((i) => i.assigneeName), (i) => i.assigneeName!)} />;
  }

  if (kind === 'sla_breaches') {
    const breached = items.filter(isBreached);
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="text-2xl font-semibold text-danger flex-shrink-0">{breached.length}</div>
        <div className="text-[11px] text-label mb-2 flex-shrink-0">items past their SLA target</div>
        <div className="flex-1 overflow-y-auto scroll-thin flex flex-col gap-1.5 min-h-0">
          {breached.slice(0, 8).map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-[12px]">
              <span className="font-mono text-label flex-shrink-0">{i.ref}</span>
              <span className="truncate">{i.title}</span>
            </div>
          ))}
          {breached.length === 0 && <p className="text-[12px] text-body">Nothing breaching SLA.</p>}
        </div>
      </div>
    );
  }

  if (kind === 'recent_activity') {
    const recent = [...items]
      .filter((i) => i.createdAt)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, 10);
    return (
      <div className="flex-1 overflow-y-auto scroll-thin flex flex-col gap-2 min-h-0">
        {recent.map((i) => (
          <div key={i.id} className="flex items-center gap-2 text-[12px]">
            <Icon name="add_circle" size={13} className="text-label flex-shrink-0" />
            <span className="font-mono text-label flex-shrink-0">{i.ref}</span>
            <span className="truncate">{i.title}</span>
          </div>
        ))}
        {recent.length === 0 && <p className="text-[12px] text-body">No items yet.</p>}
      </div>
    );
  }

  if (kind === 'rice_top') {
    const top = [...items].filter((i) => i.riceScore != null).sort((a, b) => (b.riceScore ?? 0) - (a.riceScore ?? 0)).slice(0, 8);
    return (
      <div className="flex-1 overflow-y-auto scroll-thin flex flex-col gap-1.5 min-h-0">
        {top.map((i, idx) => (
          <div key={i.id} className="flex items-center gap-2 text-[12px]">
            <span className="w-4 text-label flex-shrink-0">{idx + 1}</span>
            <span className="truncate flex-1">{i.title}</span>
            <span className="font-mono font-semibold text-pm flex-shrink-0">{i.riceScore?.toFixed(1)}</span>
          </div>
        ))}
        {top.length === 0 && <p className="text-[12px] text-body">No RICE scores yet.</p>}
      </div>
    );
  }

  return null;
}
