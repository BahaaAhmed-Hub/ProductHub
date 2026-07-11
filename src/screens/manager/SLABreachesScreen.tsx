import { TopNav } from '@/components/layout/TopNav';
import { KPITile } from '@/components/ui/KPITile';
import { PriorityTag } from '@/components/ui/Tag';
import { useRequests } from '@/features/requests/hooks';
import type { Priority } from '@/types/domain';

// Resolution SLA target in hours by priority.
const TARGET_H: Record<Priority, number> = { critical: 8, high: 24, medium: 72, low: 120 };

function slaState(createdAt: string | undefined, priority: Priority, resolved: boolean) {
  if (resolved) return { label: 'Met', kind: 'ok' as const, hoursLeft: 0 };
  if (!createdAt) return null;
  const target = TARGET_H[priority];
  const elapsedH = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  const left = target - elapsedH;
  if (left <= 0) return { label: `Breached ${Math.abs(left).toFixed(0)}h`, kind: 'breach' as const, hoursLeft: left };
  if (left <= target * 0.25) return { label: `${left.toFixed(0)}h left`, kind: 'risk' as const, hoursLeft: left };
  return { label: `${left.toFixed(0)}h left`, kind: 'ok' as const, hoursLeft: left };
}

/** Screen 30 — Manager SLA breaches (computed from request timestamps). */
export function SLABreachesScreen() {
  const { requests } = useRequests();
  const rows = requests
    .map((r) => ({ r, sla: slaState(r.createdAt, r.priority, r.status === 'resolved') }))
    .filter((x) => x.sla && (x.sla.kind === 'breach' || x.sla.kind === 'risk'))
    .sort((a, b) => (a.sla!.hoursLeft) - (b.sla!.hoursLeft));

  const breached = rows.filter((x) => x.sla!.kind === 'breach').length;
  const atRisk = rows.filter((x) => x.sla!.kind === 'risk').length;

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">SLA breaches</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <div className="grid grid-cols-3 gap-3 max-w-2xl mb-5">
          <KPITile label="Breached" value={breached} sub="past SLA target" />
          <KPITile label="At risk" value={atRisk} sub="< 25% time left" />
          <KPITile label="Open requests" value={requests.filter((r) => r.status !== 'resolved').length} />
        </div>

        {rows.length === 0 ? (
          <p className="text-[13px] text-body">No SLA breaches or at-risk requests. 🎉</p>
        ) : (
          <div className="bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame overflow-hidden max-w-4xl">
            <div className="grid grid-cols-[92px_1fr_120px_90px_130px] gap-3 px-4 py-2.5 text-eyebrow font-medium uppercase text-label border-b-[0.5px] border-hairline">
              <span>Ref</span><span>Subject</span><span>Customer</span><span>Priority</span><span className="text-right">SLA</span>
            </div>
            {rows.map(({ r, sla }) => (
              <div key={r.id} className="grid grid-cols-[92px_1fr_120px_90px_130px] gap-3 items-center px-4 h-12 border-b-[0.5px] border-hairline last:border-0">
                <span className="font-mono text-[11px] text-label">{r.ref}</span>
                <span className="text-[13px] font-medium truncate">{r.subject}</span>
                <span className="text-[12px] text-body truncate">{r.submittedByName}</span>
                <span><PriorityTag priority={r.priority} /></span>
                <span className={`text-[12px] text-right font-mono font-semibold ${sla!.kind === 'breach' ? 'text-danger' : 'text-[#9A6410]'}`}>
                  {sla!.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
