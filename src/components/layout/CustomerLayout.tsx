import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { DevRoleSwitcher } from './DevRoleSwitcher';
import { useAuth } from '@/features/auth/AuthProvider';

function crumb(pathname: string): string {
  if (pathname.startsWith('/requests')) return 'My requests';
  if (pathname.startsWith('/submit')) return 'Submit';
  return 'Support';
}

/** Customer app shell — top nav (screens 02, 04–06). */
export function CustomerLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-canvas">
      <header className="h-14 flex-shrink-0 border-b-[0.5px] border-hairline bg-surface flex items-center justify-between px-6">
        <Link to="/requests" className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-navy text-white text-xs font-bold flex items-center justify-center">
            P
          </div>
          <span className="text-sm font-semibold tracking-tight">ProductHub</span>
          <span className="text-hairline">/</span>
          <span className="text-sm text-label">{crumb(pathname)}</span>
        </Link>

        <div className="flex items-center gap-2 h-9 px-3 rounded-control border-[0.5px] border-hairline bg-canvas w-[280px]">
          <Icon name="search" size={16} className="text-label" />
          <span className="text-[13px] text-label">Search requests…</span>
        </div>

        <div className="flex items-center gap-4">
          <NavLink
            to="/requests"
            className={({ isActive }) =>
              `text-[13px] ${isActive ? 'text-ink font-medium' : 'text-body hover:text-ink'}`
            }
          >
            My requests
          </NavLink>
          <NotificationBell />
          {user && <Avatar initials={user.initials} size={28} />}
        </div>
      </header>

      <main className="flex-1 overflow-auto scroll-thin">
        <Outlet />
      </main>
      <DevRoleSwitcher />
    </div>
  );
}
