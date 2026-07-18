import { useState } from 'react';
import clsx from 'clsx';
import { NavLink } from 'react-router-dom';
import { NAV } from '@/app/navConfig';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';

export function Sidebar() {
  const { user, signOut } = useAuth();
  const sections = user ? NAV[user.role] : [];
  // Collapsed-section titles; a section stays expanded the first time it's
  // seen (default open) unless the user explicitly collapses it. Sections
  // containing the active route never start collapsed, so navigating never
  // hides the current page.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (!user) return null;

  function toggle(title: string) {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  return (
    <aside className="w-[196px] flex-shrink-0 bg-surface border-r-[0.5px] border-hairline flex flex-col justify-between py-3.5 px-2.5">
      <div className="flex flex-col gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-[60px] h-[60px] rounded-xl bg-navy text-white text-2xl font-bold flex items-center justify-center flex-shrink-0">
            P
          </div>
          <span className="text-sm font-semibold tracking-tight">ProductHub</span>
        </div>

        {sections.map((section, i) => {
          const title = section.title;
          const open = !title || !collapsed.has(title);
          return (
            <div key={i} className="flex flex-col gap-0.5">
              {title && (
                <button
                  type="button"
                  onClick={() => toggle(title)}
                  className="flex items-center justify-between px-2 mb-1 group"
                >
                  <span className="text-eyebrow font-medium uppercase text-label">{title}</span>
                  <Icon
                    name="expand_more"
                    size={14}
                    className={clsx(
                      'text-label transition-transform group-hover:text-body',
                      !open && '-rotate-90',
                    )}
                  />
                </button>
              )}
              {open &&
                section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 h-[30px] px-2.5 rounded-[7px] text-sm transition-colors',
                        isActive
                          ? 'text-navy bg-accent-bg font-medium shadow-[inset_2px_0_0_#378ADD]'
                          : 'text-body hover:bg-[#F4F3F0]',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          name={item.icon}
                          size={19}
                          className={isActive ? 'text-accent' : 'text-label'}
                        />
                        <span className="flex-1">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
            </div>
          );
        })}
      </div>

      {/* User footer */}
      <div className="border-t-[0.5px] border-hairline pt-2.5 flex items-center gap-2">
        <Avatar initials={user.initials} tone="accent" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium leading-tight truncate">{user.name}</div>
          <div className="text-[11px] text-label capitalize">{user.role}</div>
        </div>
        <button onClick={signOut} title="Sign out" className="text-label hover:text-body">
          <Icon name="logout" size={18} />
        </button>
      </div>
    </aside>
  );
}
