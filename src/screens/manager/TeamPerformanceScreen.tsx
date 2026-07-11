import { TopNav } from '@/components/layout/TopNav';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { useBoardItems } from '@/features/board/hooks';

/** Screen 31 — Manager team performance (aggregated from backlog items). */
export function TeamPerformanceScreen() {
  const { items } = useBoardItems();

  const byPerson = new Map<string, { name: string; initials: string; assigned: number; released: number; active: number }>();
  for (const it of items) {
    const name = it.assigneeName ?? 'Unassigned';
    const initials = it.assigneeInitials ?? '—';
    const cur = byPerson.get(name) ?? { name, initials, assigned: 0, released: 0, active: 0 };
    cur.assigned += 1;
    if (it.boardStatus === 'released') cur.released += 1;
    else cur.active += 1;
    byPerson.set(name, cur);
  }
  const team = [...byPerson.values()].sort((a, b) => b.assigned - a.assigned);

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Team performance</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <h1 className="text-lg font-semibold tracking-tight mb-4">Team performance</h1>
        <Card className="p-5 max-w-3xl">
          <div className="grid grid-cols-[1fr_110px_110px_90px] gap-3 px-1 pb-2 text-eyebrow font-medium uppercase text-label border-b-[0.5px] border-hairline">
            <span>Member</span><span className="text-right">Assigned</span>
            <span className="text-right">Released</span><span className="text-right">Active</span>
          </div>
          {team.length === 0 ? (
            <div className="py-6 text-[13px] text-body">No assigned work yet.</div>
          ) : (
            team.map((t) => (
              <div key={t.name} className="grid grid-cols-[1fr_110px_110px_90px] gap-3 items-center px-1 h-12 border-b-[0.5px] border-hairline last:border-0">
                <div className="flex items-center gap-2.5">
                  <Avatar initials={t.initials} size={26} />
                  <span className="text-[13px] font-medium">{t.name}</span>
                </div>
                <span className="text-[13px] text-right font-mono">{t.assigned}</span>
                <span className="text-[13px] text-right font-mono text-success">{t.released}</span>
                <span className="text-[13px] text-right font-mono text-body">{t.active}</span>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}
