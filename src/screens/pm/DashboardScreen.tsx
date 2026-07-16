import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts';
import { TopNav } from '@/components/layout/TopNav';
import { KPITile } from '@/components/ui/KPITile';
import { Card } from '@/components/ui/Card';
import { useBoardItems } from '@/features/board/hooks';
import { useReleases } from '@/features/planning';

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  on_track: { label: 'On track', tone: 'text-success' },
  planned: { label: 'Planned', tone: 'text-body' },
  at_risk: { label: 'At risk', tone: 'text-danger' },
  released: { label: 'Released', tone: 'text-success' },
};

/** Screen 15 — PM dashboard (real workspace data; empty states until items exist). */
export function DashboardScreen() {
  const { items } = useBoardItems();
  const { releases } = useReleases();
  const done = items.filter((i) => i.boardStatus === 'released').length;
  const backlogOpen = items.filter((i) => i.boardStatus !== 'released').length;
  const progress = items.length ? Math.round((done / items.length) * 100) : 0;

  const burndown = [
    { label: 'Triaged', v: items.filter((i) => i.boardStatus === 'triaged').length },
    { label: 'In Dev', v: items.filter((i) => i.boardStatus === 'in_development').length },
    { label: 'In QA', v: items.filter((i) => i.boardStatus === 'in_qa').length },
    { label: 'Released', v: done },
  ];

  const riceQueue = [...items]
    .filter((i) => i.riceScore != null)
    .sort((a, b) => (b.riceScore ?? 0) - (a.riceScore ?? 0))
    .slice(0, 4);

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Dashboard</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <div className="grid grid-cols-4 gap-3">
          <KPITile label="Backlog (open)" value={backlogOpen} sub="items not yet released" />
          <KPITile label="Progress" value={`${progress}%`} sub={`${done} / ${items.length || 0} done`} />
          <KPITile label="Releases" value={releases.length} sub="planned or shipped" />
          <KPITile label="Scored (RICE)" value={riceQueue.length} sub="ranked in backlog" />
        </div>

        <div className="grid grid-cols-[1fr_320px] gap-4 mt-4">
          <Card className="p-5">
            <div className="text-sm font-semibold mb-4">Backlog by status</div>
            {items.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={burndown} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8A8983' }} />
                  <Bar dataKey="v" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {burndown.map((d, i) => (
                      <Cell key={i} fill={d.label === 'Released' ? '#1D9E75' : '#534AB7'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <div className="text-sm font-semibold mb-3">Releases</div>
              {releases.length === 0 ? (
                <p className="text-[13px] text-body">No releases yet — create one in Release Tree.</p>
              ) : (
                releases.map((r) => {
                  const st = STATUS_LABEL[r.status] ?? { label: r.status, tone: 'text-body' };
                  return (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b-[0.5px] border-hairline last:border-0">
                      <div>
                        <div className="text-[13px] font-medium flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-pm" />
                          {r.name}
                        </div>
                        {r.targetDate && <div className="text-[11px] text-label ml-3.5">{r.targetDate}</div>}
                      </div>
                      <span className={`text-[12px] font-medium ${st.tone}`}>{st.label}</span>
                    </div>
                  );
                })
              )}
            </Card>
            <Card className="p-5">
              <div className="text-sm font-semibold mb-3">RICE queue</div>
              {riceQueue.length === 0 ? (
                <p className="text-[13px] text-body">No items scored yet — score them in Backlog.</p>
              ) : (
                riceQueue.map((i) => (
                  <div key={i.id} className="flex items-center justify-between py-1.5">
                    <span className="text-[13px] truncate pr-3">{i.title}</span>
                    <span className="text-[13px] font-mono font-semibold text-pm">{i.riceScore?.toFixed(1)}</span>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function EmptyChart() {
  return (
    <div className="h-[260px] flex items-center justify-center text-[13px] text-body border border-dashed border-hairline rounded-lg">
      Backlog is empty — add items in Triage Inbox or Backlog.
    </div>
  );
}
