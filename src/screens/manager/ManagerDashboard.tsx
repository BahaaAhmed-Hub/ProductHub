import { TopNav } from '@/components/layout/TopNav';
import { KPITile } from '@/components/ui/KPITile';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';

const TEAM = [
  { name: 'Sara K.', initials: 'SK', resolved: 18, sla: 96, load: 7 },
  { name: 'Devon R.', initials: 'DR', resolved: 14, sla: 91, load: 5 },
  { name: 'Amir R.', initials: 'AR', resolved: 11, sla: 88, load: 6 },
];

/** Screen 29 — Manager oversight dashboard. */
export function ManagerDashboard() {
  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Dashboard</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <h1 className="text-lg font-semibold tracking-tight mb-4">Team overview</h1>
        <div className="grid grid-cols-4 gap-3">
          <KPITile label="SLA compliance" value="92%" delta={2} deltaLabel="pt vs last month" />
          <KPITile label="Open · at risk" value={2} sub="need attention today" />
          <KPITile label="Avg first response" value="1.4h" delta={-0.3} deltaLabel="h" invertDelta />
          <KPITile label="Resolved · 30d" value={143} delta={11} deltaLabel="%" />
        </div>

        <div className="grid grid-cols-[1fr_320px] gap-4 mt-4">
          <Card className="p-5">
            <div className="text-sm font-semibold mb-3">Team performance</div>
            <div className="grid grid-cols-[1fr_100px_90px_70px] gap-3 px-1 pb-2 text-eyebrow font-medium uppercase text-label border-b-[0.5px] border-hairline">
              <span>Developer</span><span className="text-right">Resolved</span>
              <span className="text-right">SLA %</span><span className="text-right">Load</span>
            </div>
            {TEAM.map((t) => (
              <div key={t.name} className="grid grid-cols-[1fr_100px_90px_70px] gap-3 items-center px-1 h-12 border-b-[0.5px] border-hairline last:border-0">
                <div className="flex items-center gap-2.5">
                  <Avatar initials={t.initials} size={26} />
                  <span className="text-[13px] font-medium">{t.name}</span>
                </div>
                <span className="text-[13px] text-right font-mono">{t.resolved}</span>
                <span className={`text-[13px] text-right font-mono ${t.sla >= 90 ? 'text-success' : 'text-[#9A6410]'}`}>{t.sla}%</span>
                <span className="text-[13px] text-right font-mono text-body">{t.load}</span>
              </div>
            ))}
          </Card>

          <Card className="p-5">
            <div className="text-sm font-semibold mb-3">SLA breaches · 30d</div>
            <div className="text-[40px] font-semibold text-danger leading-none">3</div>
            <p className="text-[12px] text-body mt-2">
              2 in Billing, 1 in Platform. All resolved within 2h of breach. Trend down 40% vs prior month.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
