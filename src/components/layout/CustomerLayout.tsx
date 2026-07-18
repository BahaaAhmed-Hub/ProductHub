import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Logo } from '@/components/ui/Logo';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useAuth } from '@/features/auth/AuthProvider';

const ROLE_LABEL: Record<string, string> = {
  customer: 'Customer', developer: 'Developer', pm: 'Product Manager', manager: 'Manager', stakeholder: 'Stakeholder',
};

function crumb(pathname: string): string {
  if (pathname.startsWith('/requests')) return 'My requests';
  if (pathname.startsWith('/submit')) return 'Submit';
  return 'Support';
}

/** Customer app shell — top nav (screens 02, 04–06). */
export function CustomerLayout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const pending = user?.status === 'pending';

  async function onSignOut() {
    await signOut();
    navigate('/signin');
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-canvas">
      <header className="h-14 flex-shrink-0 border-b-[0.5px] border-hairline bg-surface flex items-center justify-between px-6">
        <Link to="/requests" className="flex items-center gap-2.5">
          <Logo size={24} className="text-navy" />
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
          {user && (
            <div className="relative">
              <button onClick={() => setMenu((m) => !m)} aria-label="Account">
                <Avatar initials={user.initials} size={28} />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 top-10 z-50 w-[260px] bg-surface border-[0.5px] border-hairline rounded-frame shadow-pop overflow-hidden">
                    <div className="px-3 py-3 border-b-[0.5px] border-hairline">
                      <div className="text-[13px] font-semibold truncate">{user.name}</div>
                      <div className="text-[11px] text-label truncate">{user.email}</div>
                      <div className="mt-2 inline-flex items-center h-5 px-2 rounded-full bg-pm-bg text-pm text-[10px] font-medium uppercase tracking-wide">
                        {ROLE_LABEL[user.role] ?? user.role}
                      </div>
                    </div>
                    <button onClick={onSignOut} className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-body hover:bg-[#F4F3F0]">
                      <Icon name="logout" size={16} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {pending && (
        <div className="flex items-center gap-2 px-6 py-2 bg-[#FBF0DD] border-b-[0.5px] border-[#E7CE9B] text-[12px] text-[#8A5A0B]">
          <Icon name="schedule" size={14} />
          <span>
            Your <b>{ROLE_LABEL[user!.requestedRole ?? 'customer']}</b> access is pending approval by an admin in your
            organization. You have Customer access until then.
          </span>
        </div>
      )}

      <main className="flex-1 overflow-auto scroll-thin">
        <Outlet />
      </main>
    </div>
  );
}
