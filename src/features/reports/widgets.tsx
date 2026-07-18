import { Icon } from '@/components/ui/Icon';
import { useBoardItems } from '@/features/board/hooks';
import type { BoardItem } from '@/features/board/types';
import type { ReportWidget } from './index';
import { computeSpecData } from './customSpec';

const CHART_COLORS = ['#534AB7', '#378ADD', '#1D9E75', '#B8860B', '#9c2b29', '#8A5A0B', '#3F3791', '#888780'];

function tally<T extends string>(items: BoardItem[], key: (i: BoardItem) => T): { label: T; n: number }[] {
  const m = new Map<T, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
}

/** {label,n}[] driving every switchable-chart-type widget: the fixed-kind
 * tallies (by_type/by_status/...) or a custom widget's AI-derived spec,
 * computed the same way so any of them can render as bar/pie/list/number. */
function tallyData(items: BoardItem[], widget: ReportWidget): { label: string; n: number }[] {
  switch (widget.kind) {
    case 'by_type':
      return tally(items, (i) => i.type);
    case 'by_status':
      return tally(items, (i) => i.boardStatus);
    case 'by_priority':
      return tally(items, (i) => i.priority);
    case 'team_workload':
      return tally(items.filter((i) => i.assigneeName), (i) => i.assigneeName!);
    case 'rice_top':
      return [...items]
        .filter((i) => i.riceScore != null)
        .sort((a, b) => (b.riceScore ?? 0) - (a.riceScore ?? 0))
        .slice(0, 8)
        .map((i) => ({ label: i.title, n: Number((i.riceScore ?? 0).toFixed(1)) }));
    case 'custom':
      return computeSpecData(items, widget.spec);
    default:
      return [];
  }
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
          <span className="text-[12px] font-mono w-10 text-right flex-shrink-0">{d.n}</span>
        </div>
      ))}
    </div>
  );
}

function PieChart({ data }: { data: { label: string; n: number }[] }) {
  const total = data.reduce((s, d) => s + d.n, 0);
  if (total === 0 || data.length === 0) return <p className="text-[13px] text-body">No data.</p>;
  let acc = 0;
  const stops = data.map((d, i) => {
    const start = (acc / total) * 100;
    acc += d.n;
    const end = (acc / total) * 100;
    return `${CHART_COLORS[i % CHART_COLORS.length]} ${start}% ${end}%`;
  });
  return (
    <div className="flex items-center gap-4 flex-1 min-h-0">
      <div className="w-20 h-20 rounded-full flex-shrink-0" style={{ background: `conic-gradient(${stops.join(', ')})` }} />
      <div className="flex-1 min-w-0 overflow-y-auto scroll-thin flex flex-col gap-1.5">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="truncate flex-1 capitalize">{d.label.replace(/_/g, ' ')}</span>
            <span className="font-mono text-label flex-shrink-0">{d.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankedList({ data }: { data: { label: string; n: number }[] }) {
  if (data.length === 0) return <p className="text-[13px] text-body">No data.</p>;
  return (
    <div className="flex-1 overflow-y-auto scroll-thin flex flex-col gap-1.5 min-h-0">
      {data.map((d, idx) => (
        <div key={d.label} className="flex items-center gap-2 text-[12px]">
          <span className="w-4 text-label flex-shrink-0">{idx + 1}</span>
          <span className="truncate flex-1 capitalize">{d.label.replace(/_/g, ' ')}</span>
          <span className="font-mono font-semibold text-pm flex-shrink-0">{d.n}</span>
        </div>
      ))}
    </div>
  );
}

function NumberStat({ data }: { data: { label: string; n: number }[] }) {
  const total = data.reduce((s, d) => s + d.n, 0);
  const top = data[0];
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center">
      <div className="text-4xl font-semibold text-pm">{total}</div>
      {top && <div className="text-[12px] text-label mt-1 capitalize">top: {top.label.replace(/_/g, ' ')} ({top.n})</div>}
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

/** Renders a widget's content — the fixed-kind tallies and custom (AI) specs
 * share one chart-type-switchable renderer (bar/pie/list/number); the two
 * feed/stat kinds (sla_breaches, recent_activity) keep their own fixed
 * presentation, since a bar or pie chart wouldn't mean anything for them. */
export function WidgetContent({ widget }: { widget: ReportWidget }) {
  const { items } = useBoardItems();

  if (widget.kind === 'sla_breaches') {
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

  if (widget.kind === 'recent_activity') {
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

  const data = tallyData(items, widget);
  if (widget.chartType === 'pie') return <PieChart data={data} />;
  if (widget.chartType === 'number') return <NumberStat data={data} />;
  if (widget.chartType === 'list') return <RankedList data={data} />;
  return <BarList data={data} />;
}
