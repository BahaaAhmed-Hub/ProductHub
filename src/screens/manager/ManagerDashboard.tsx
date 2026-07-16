import { TopNav } from '@/components/layout/TopNav';
import { KPITile } from '@/components/ui/KPITile';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { useBoardItems } from '@/features/board/hooks';
import { useRequests } from '@/features/requests/hooks';
import type { Priority } from '@/types/domain';

const TARGET_H: Record<Priority, number> = { critical: 8, high: 24, medium: 72, low: 120 };

/** Screen 29 — Manager oversight dashboard (real aggregates from the workspace). */
export function ManagerDashboard() {
  const { items } = useBoardItems();
  const { requests } = useRequests();

  // SLA compliance from requests (met = resolved, or within target)
  const openReqs = requests.filter((r) => r.status !== 'resolved');
  const atRisk = openReqs.filter((r) => {
    if (!r.createdAt) return false;
    const left = TARGET_H[r.priority] - (Date.now() - new Date(r.createdAt).getTime()) / 3_600_000;
    return left <= TARGET_H[r.priority] * 0.25;
  }).length;
  const breached = openReqs.filter((r) => {
    if (!r.createdAt) return false;
    return TARGET_H[r.priority] - (Date.now() - new Date(r.createdAt).getTime()) / 3_600_000 <= 0;
  }).length;
  const compliance = requests.length ? Math.round(((requests.length - breached) / requests.length) * 100) : 100;
  const resolved = items.filter((i) => i.boardStatus === 'released').length;

  // Team aggregation from board items
  const byPerson = new Map<string, { name: string; initials: string; resolved: number; load: number }>();
  for (const it of items) {
    const name = it.assigneeName ?? 'Unassigned';
    const cur = byPerson.get(name) ?? { name, initials: it.assigneeInitials ?? '—', resolved: 0, load: 0 };
    if (it.boardStatus === 'released') cur.resolved += 1;
    else cur.load += 1;
    byPerson.set(name, cur);
  }
  const team = [...byPerson.values()].sort((a, b) => b.resolved - a.resolved);

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Dashboard</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <h1 className="text-lg font-semibold tracking-tight mb-4">Team overview</h1>
        <div className="grid grid-cols-4 gap-3">
          <KPITile label="SLA compliance" value={`${compliance}%`} sub={`${requests.length} requests`} />
          <KPITile label="Open · at risk" value={atRisk} sub="< 25% time left" />
          <KPITile label="Open requests" value={openReqs.length} />
          <KPITile label="Resolved (released)" value={resolved} />
        </div>

        <div className="grid grid-cols-[1fr_320px] gap-4 mt-4">
          <Card className="p-5">
            <div className="text-sm font-semibold mb-3">Team performance</div>
            <div className="grid grid-cols-[1fr_100px_70px] gap-3 px-1 pb-2 text-eyebrow font-medium uppercase text-label border-b-[0.5px] border-hairline">
              <span>Developer</span><span className="text-right">Resolved</span><span className="text-right">Active</span>
            </div>
            {team.length === 0 ? (
              <div className="py-6 text-[13px] text-body">No assigned work yet.</div>
            ) : (
              team.map((t) => (
                <div key={t.name} className="grid grid-cols-[1fr_100px_70px] gap-3 items-center px-1 h-12 border-b-[0.5px] border-hairline last:border-0">
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={t.initials} size={26} />
                    <span className="text-[13px] font-medium">{t.name}</span>
                  </div>
                  <span className="text-[13px] text-right font-mono text-success">{t.resolved}</span>
                  <span className="text-[13px] text-right font-mono text-body">{t.load}</span>
                </div>
              ))
            )}
          </Card>

          <Card className="p-5">
            <div className="text-sm font-semibold mb-3">SLA breaches (open)</div>
            <div className={`text-[40px] font-semibold leading-none ${breached ? 'text-danger' : 'text-success'}`}>{breached}</div>
            <p className="text-[12px] text-body mt-2">
              {breached === 0
                ? 'No open requests past their SLA target. 🎉'
                : `${breached} open request${breached > 1 ? 's' : ''} past target, ${atRisk} more at risk.`}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
