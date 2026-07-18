import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNotifications, useMarkAllRead } from '@/features/notifications';

interface TopNavProps {
  center?: ReactNode;
  actions?: ReactNode;
  /** ignored when notifications are live; kept for API compatibility */
  notificationCount?: number;
}

const ROLE_LABEL: Record<string, string> = {
  customer: 'Customer', developer: 'Developer', pm: 'Product Manager', manager: 'Manager', stakeholder: 'Stakeholder',
};

export function TopNav({ center, actions }: TopNavProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { notes, unread } = useNotifications();
  const markAll = useMarkAllRead();
  const [open, setOpen] = useState<null | 'bell' | 'profile'>(null);

  async function onSignOut() {
    await signOut();
    navigate('/signin');
  }

  return (
    <header className="h-[52px] flex-shrink-0 border-b-[0.5px] border-hairline flex items-center justify-between px-3.5 bg-surface relative">
      {/* Spacer — mirrors the width of the right-side action cluster so
          `center` stays visually centered. The ProductHub logo already
          lives in the Sidebar; rendering it again here duplicated it on
          every internal screen. */}
      <div className="w-52" />

      <div className="flex-1 flex items-center justify-center gap-4">{center}</div>

      <div className="flex items-center gap-2.5 w-52 justify-end">
        {actions}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setOpen(open === 'bell' ? null : 'bell')}
            className="relative w-[30px] h-[30px] rounded-[7px] flex items-center justify-center hover:bg-[#F4F3F0]"
            aria-label="Notifications"
          >
            <Icon name="notifications" size={19} className="text-body" />
            {unread > 0 && (
              <span className="absolute top-[3px] right-[3px] min-w-3.5 h-3.5 px-1 rounded-full bg-danger text-white text-[8px] font-bold flex items-center justify-center border-[1.5px] border-surface">
                {unread}
              </span>
            )}
          </button>
          {open === 'bell' && (
            <Dropdown onClose={() => setOpen(null)}>
              <div className="flex items-center justify-between px-3 py-2.5 border-b-[0.5px] border-hairline">
                <span className="text-[13px] font-semibold">Notifications</span>
                {unread > 0 && (
                  <button className="text-[11px] text-accent" onClick={() => markAll()}>Mark all read</button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto scroll-thin">
                {notes.length === 0 && (
                  <div className="px-3 py-8 text-center text-[12px] text-label">You're all caught up.</div>
                )}
                {notes.map((n) => (
                  <div key={n.id} className={`px-3 py-2.5 border-b-[0.5px] border-hairline last:border-0 flex gap-2.5 ${n.read ? '' : 'bg-accent-bg/40'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-transparent' : 'bg-accent'}`} />
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium leading-snug">{n.title}</div>
                      {n.body && <div className="text-[11px] text-body mt-0.5">{n.body}</div>}
                      <div className="text-[10px] text-label mt-0.5">{n.ago}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Dropdown>
          )}
        </div>

        {/* Profile */}
        {user && (
          <div className="relative">
            <button onClick={() => setOpen(open === 'profile' ? null : 'profile')} className="rounded-full" aria-label="Account">
              <Avatar initials={user.initials} />
            </button>
            {open === 'profile' && (
              <Dropdown onClose={() => setOpen(null)}>
                <div className="px-3 py-3 border-b-[0.5px] border-hairline">
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={user.initials} size={34} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold truncate">{user.name}</div>
                      <div className="text-[11px] text-label truncate">{user.email}</div>
                    </div>
                  </div>
                  <div className="mt-2 inline-flex items-center h-5 px-2 rounded-full bg-pm-bg text-pm text-[10px] font-medium uppercase tracking-wide">
                    {ROLE_LABEL[user.role] ?? user.role}
                  </div>
                </div>
                <button
                  onClick={onSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-body hover:bg-[#F4F3F0]"
                >
                  <Icon name="logout" size={16} /> Sign out
                </button>
              </Dropdown>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function Dropdown({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-[38px] z-50 w-[280px] bg-surface border-[0.5px] border-hairline rounded-frame shadow-pop overflow-hidden">
        {children}
      </div>
    </>
  );
}
