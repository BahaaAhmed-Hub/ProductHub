import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';

interface TopNavProps {
  /** center content — usually a breadcrumb or search */
  center?: ReactNode;
  /** right-aligned actions rendered before the notification bell */
  actions?: ReactNode;
  notificationCount?: number;
}

export function TopNav({ center, actions, notificationCount = 0 }: TopNavProps) {
  const { user } = useAuth();
  return (
    <header className="h-[52px] flex-shrink-0 border-b-[0.5px] border-hairline flex items-center justify-between px-3.5 bg-surface">
      <div className="flex items-center gap-2 w-52">
        <div className="w-5 h-5 rounded-md bg-navy text-white text-xs font-bold flex items-center justify-center">
          P
        </div>
        <span className="text-sm font-semibold tracking-tight">ProductHub</span>
      </div>

      <div className="flex-1 flex items-center justify-center gap-4">{center}</div>

      <div className="flex items-center gap-2.5 w-52 justify-end">
        {actions}
        <button className="relative w-[30px] h-[30px] rounded-[7px] flex items-center justify-center hover:bg-[#F4F3F0]">
          <Icon name="notifications" size={19} className="text-body" />
          {notificationCount > 0 && (
            <span className="absolute top-[3px] right-[3px] min-w-3.5 h-3.5 px-1 rounded-full bg-danger text-white text-[8px] font-bold flex items-center justify-center border-[1.5px] border-surface">
              {notificationCount}
            </span>
          )}
        </button>
        {user && <Avatar initials={user.initials} />}
      </div>
    </header>
  );
}
