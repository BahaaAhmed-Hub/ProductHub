import { TopNav } from '@/components/layout/TopNav';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useBoardItems } from '@/features/board/hooks';
import type { BoardItem } from '@/features/board/types';

function tally<T extends string>(items: BoardItem[], key: (i: BoardItem) => T): { label: T; n: number }[] {
  const m = new Map<T, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
}

function downloadCsv(items: BoardItem[]) {
  const header = ['ref', 'title', 'type', 'status', 'priority', 'rice', 'wsjf', 'effort'];
  const rows = items.map((i) =>
    [i.ref, `"${i.title.replace(/"/g, '""')}"`, i.type, i.boardStatus, i.priority, i.riceScore ?? '', i.wsjfScore ?? '', i.effort ?? ''].join(','),
  );
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'producthub-backlog.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** Screen 32 — Manager reports (real aggregates + CSV export). */
export function ReportsScreen() {
  const { items } = useBoardItems();
  const byType = tally(items, (i) => i.type);
  const byStatus = tally(items, (i) => i.boardStatus);
  const byPriority = tally(items, (i) => i.priority);
  const max = Math.max(1, ...items.length ? [items.length] : [1]);

  const Section = ({ title, data }: { title: string; data: { label: string; n: number }[] }) => (
    <Card className="p-5">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {data.length === 0 ? (
        <p className="text-[13px] text-body">No data.</p>
      ) : (
        data.map((d) => (
          <div key={d.label} className="flex items-center gap-3 py-1.5">
            <span className="text-[12px] w-28 capitalize text-body">{d.label.replace('_', ' ')}</span>
            <div className="flex-1 h-2 rounded-full bg-[#ECEBE7] overflow-hidden">
              <div className="h-full bg-pm rounded-full" style={{ width: `${(d.n / max) * 100}%` }} />
            </div>
            <span className="text-[12px] font-mono w-6 text-right">{d.n}</span>
          </div>
        ))
      )}
    </Card>
  );

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Reports</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
            <p className="text-xs text-label mt-0.5">{items.length} backlog items · live from your workspace</p>
          </div>
          <Button icon="summarize" onClick={() => downloadCsv(items)} disabled={items.length === 0}>
            Export CSV
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-4 max-w-5xl">
          <Section title="By type" data={byType} />
          <Section title="By status" data={byStatus} />
          <Section title="By priority" data={byPriority} />
        </div>
      </div>
    </>
  );
}
