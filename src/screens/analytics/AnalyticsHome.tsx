import { TopNav } from '@/components/layout/TopNav';
import { KPITile } from '@/components/ui/KPITile';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

interface Friction {
  title: string;
  severity: 'high' | 'medium' | 'low';
  meta: string;
}
const FRICTION: Friction[] = [
  { title: 'Paste blocked on mobile checkout', severity: 'high', meta: '87 sessions · last 48h · step 2 of 4' },
  { title: 'Rage clicks on "Apply coupon"', severity: 'high', meta: '54 sessions · last 7d' },
  { title: 'Onboarding stop 2 skipped by power users', severity: 'low', meta: '31 sessions' },
];
const SEV: Record<Friction['severity'], string> = { high: '#C93535', medium: '#D97706', low: '#639922' };

/** Screen 26 — Analytics home (Lens). Friction feed + KPIs + sessions to review. */
export function AnalyticsHome() {
  return (
    <>
      <TopNav
        center={<span className="text-[13px] text-body">Analytics</span>}
        actions={
          <span className="inline-flex items-center h-7 px-3 rounded-control border-[0.5px] border-hairline bg-surface text-[12px] text-body">
            Last 7 days
          </span>
        }
        notificationCount={4}
      />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>
        <p className="text-xs text-label mt-0.5 mb-4">
          Self-hosted on PostHog · ClickHouse — what's broken, what's ignored, what's working
        </p>

        <div className="grid grid-cols-4 gap-3">
          <KPITile label="Active users · 7d" value="12,840" delta={4.2} deltaLabel="%" />
          <KPITile label="Rage-click rate" value="3.2%" delta={0.8} deltaLabel="pt" invertDelta />
          <KPITile label="Onboarding completion" value="68%" delta={-4} deltaLabel="pt" />
          <KPITile label="Est. revenue at risk" value="$4,200" sub="3 checkout drop-offs" />
        </div>

        <div className="grid grid-cols-[1fr_320px] gap-4 mt-4">
          <Card className="p-5">
            <div className="text-sm font-semibold mb-3">Friction feed</div>
            <div className="flex flex-col">
              {FRICTION.map((f) => (
                <div key={f.title} className="flex items-center gap-3 py-3 border-b-[0.5px] border-hairline last:border-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SEV[f.severity] }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{f.title}</div>
                    <div className="text-[11px] text-label mt-0.5">{f.meta}</div>
                  </div>
                  <button className="text-[12px] text-accent inline-flex items-center gap-1 flex-shrink-0">
                    Watch sessions <Icon name="north_east" size={13} />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-semibold mb-3">Sessions to review</div>
            <SessionRow badge="8:47 / 2:14" label="Checkout · mobile Safari" />
            <SessionRow badge="1:03 / 1:40" label="Coupon field · desktop Chrome" />
            <div className="mt-3 rounded-frame bg-ai-surface p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-ai-accent mb-1.5">
                <Icon name="auto_awesome" size={13} /> AI ANALYSIS
              </div>
              <p className="text-[12px] text-ink leading-relaxed">
                These sessions share one pattern: users try to paste, get blocked, then abandon.
                Fixing clipboard access on mobile is the highest-leverage change this week.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function SessionRow({ badge, label }: { badge: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b-[0.5px] border-hairline">
      <div className="w-8 h-8 rounded-lg bg-[#EFEEE9] flex items-center justify-center flex-shrink-0">
        <Icon name="view_kanban" size={15} className="text-label" />
      </div>
      <div className="min-w-0">
        <div className="text-[12px] font-medium truncate">{label}</div>
        <div className="text-[10px] text-label font-mono">{badge}</div>
      </div>
    </div>
  );
}
