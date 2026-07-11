import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { BUCKETS, useRoadmap } from '@/features/roadmap';
import { DevRoleSwitcher } from '@/components/layout/DevRoleSwitcher';

/** Screen 49 — Stakeholder read-only roadmap / evidence viewer. */
export function StakeholderViewer() {
  const { user } = useAuth();
  const { cards } = useRoadmap();
  const published = cards.filter((c) => c.isPublished);

  return (
    <div className="min-h-screen w-screen flex flex-col bg-canvas">
      <header className="h-16 flex-shrink-0 border-b-[0.5px] border-hairline bg-surface flex items-center justify-between px-8">
        <Link to="/viewer" className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-navy text-white text-xs font-bold flex items-center justify-center">P</div>
          <span className="text-sm font-semibold tracking-tight">ProductHub</span>
          <span className="text-hairline">/</span>
          <span className="text-sm text-label">Stakeholder view</span>
        </Link>
        <div className="flex items-center gap-2 text-[12px] text-label">
          <Icon name="visibility" size={15} /> Read-only
          {user && <Avatar initials={user.initials} size={26} />}
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-8 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Product roadmap</h1>
        <p className="text-sm text-body mt-1">
          A read-only view of what's shipping, shared with stakeholders. Evidence-linked, updated as priorities shift.
        </p>

        <div className="grid grid-cols-3 gap-5 mt-8">
          {BUCKETS.map((b) => (
            <div key={b.key}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full" style={{ background: b.dot }} />
                <span className="text-[13px] font-semibold">{b.label}</span>
                <span className="text-[12px] text-label">{b.sub}</span>
              </div>
              <div className="flex flex-col gap-3">
                {published.filter((c) => c.bucket === b.key).map((c) => (
                  <div key={c.id} className="rounded-frame border-[0.5px] border-hairline bg-surface shadow-frame px-4 py-3.5">
                    <div className="text-[14px] font-semibold">{c.title}</div>
                    {c.theme && <div className="text-[12px] text-body mt-1">{c.theme}</div>}
                    <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent">
                      <Icon name="science" size={12} /> 2 research evidence
                    </div>
                  </div>
                ))}
                {published.filter((c) => c.bucket === b.key).length === 0 && (
                  <div className="rounded-frame border border-dashed border-hairline px-4 py-5 text-center text-[13px] text-label">
                    Nothing published here yet
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="h-14 flex items-center justify-center text-[11px] text-label border-t-[0.5px] border-hairline">
        Powered by ProductHub · shared by Orion Cloud
      </footer>
      <DevRoleSwitcher />
    </div>
  );
}
