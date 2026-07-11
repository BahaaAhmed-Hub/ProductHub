import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts';
import { TopNav } from '@/components/layout/TopNav';
import { KPITile } from '@/components/ui/KPITile';
import { Card } from '@/components/ui/Card';
import { useBoardItems } from '@/features/board/hooks';

const BURNDOWN = [
  { day: 'Mon', v: 31, done: false },
  { day: 'Tue', v: 28, done: false },
  { day: 'Wed', v: 24, done: false },
  { day: 'Thu', v: 18, done: true },
  { day: 'Fri', v: 18, done: true },
  { day: 'Mon', v: 11, done: true },
  { day: 'Tue', v: 7, done: true },
];

/** Screen 15 — PM dashboard. */
export function DashboardScreen() {
  const { items } = useBoardItems();
  const done = items.filter((i) => i.boardStatus === 'released').length;
  const riceQueue = [...items]
    .filter((i) => i.riceScore != null)
    .sort((a, b) => (b.riceScore ?? 0) - (a.riceScore ?? 0))
    .slice(0, 4);

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Dashboard</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <div className="grid grid-cols-4 gap-3">
          <KPITile label="Backlog size" value={42} sub="items unscheduled" />
          <KPITile label="Sprint 24 progress" value="68%" sub={`${done} / ${items.length} done`} />
          <KPITile label="Avg cycle time" value="3.4d" delta={-0.6} deltaLabel="vs last sprint" invertDelta />
          <KPITile label="At SLA risk" value={2} sub="bugs need attention" />
        </div>

        <div className="grid grid-cols-[1fr_320px] gap-4 mt-4">
          <Card className="p-5">
            <div className="text-sm font-semibold mb-4">Sprint 24 burndown</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={BURNDOWN} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#8A8983' }}
                />
                <Bar dataKey="v" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {BURNDOWN.map((d, i) => (
                    <Cell key={i} fill={d.done ? '#534AB7' : '#E6E4DE'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <div className="text-sm font-semibold mb-3">Upcoming releases</div>
              <ReleaseRow name="Release 4.3" meta="6 items · Aug 12" status="On track" tone="text-success" />
              <ReleaseRow name="Release 4.4" meta="4 items · Sep 9" status="Planned" tone="text-body" />
            </Card>
            <Card className="p-5">
              <div className="text-sm font-semibold mb-3">RICE queue</div>
              {riceQueue.map((i) => (
                <div key={i.id} className="flex items-center justify-between py-1.5">
                  <span className="text-[13px] truncate pr-3">{i.title}</span>
                  <span className="text-[13px] font-mono font-semibold text-pm">{i.riceScore?.toFixed(1)}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function ReleaseRow({ name, meta, status, tone }: { name: string; meta: string; status: string; tone: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b-[0.5px] border-hairline last:border-0">
      <div>
        <div className="text-[13px] font-medium flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-pm" />
          {name}
        </div>
        <div className="text-[11px] text-label ml-3.5">{meta}</div>
      </div>
      <span className={`text-[12px] font-medium ${tone}`}>{status}</span>
    </div>
  );
}
