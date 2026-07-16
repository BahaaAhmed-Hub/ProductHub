import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

/** Marketing-style shell for public surfaces (screens 07 roadmap, 08 release notes). */
export function PublicLayout() {
  const { pathname } = useLocation();
  const onRoadmap = pathname.startsWith('/roadmap');

  return (
    <div className="min-h-screen w-screen flex flex-col bg-canvas">
      <header className="h-16 flex-shrink-0 border-b-[0.5px] border-hairline bg-surface flex items-center justify-between px-8">
        <Link to="/roadmap" className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-navy text-white text-xs font-bold flex items-center justify-center">
            P
          </div>
          <span className="text-sm font-semibold tracking-tight">ProductHub</span>
          <span className="text-hairline">/</span>
          <span className="text-sm text-label">{onRoadmap ? 'Roadmap' : 'Release notes'}</span>
        </Link>
        <NavLink
          to={onRoadmap ? '/releases' : '/roadmap'}
          className="text-[13px] text-body hover:text-ink"
        >
          {onRoadmap ? 'Release notes' : 'Roadmap'}
        </NavLink>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="h-14 flex items-center justify-center text-[11px] text-label border-t-[0.5px] border-hairline">
        Powered by ProductHub · a product of Orion Cloud
      </footer>
    </div>
  );
}
