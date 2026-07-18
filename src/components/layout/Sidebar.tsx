import { useState } from 'react';
import clsx from 'clsx';
import { NavLink } from 'react-router-dom';
import { NAV } from '@/app/navConfig';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSettingsModalStore } from '@/features/settings/store';

export function Sidebar() {
  const { user, signOut } = useAuth();
  const openSettings = useSettingsModalStore((s) => s.openModal);
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
    <aside className="w-[196px] flex-shrink-0 bg-surface border-r-[0.5px] border-hairline flex flex-col py-3.5 px-2.5 overflow-hidden">
      {/* Scrolls independently of the footer below — with every section
          expanded, nav content can exceed the sidebar's height; without a
          dedicated scroll container here, it simply overflowed past the
          viewport and pushed the footer out of view. */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin flex flex-col gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-2">
          <Logo size={60} className="text-navy flex-shrink-0" />
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

      {/* User footer — pinned outside the scroll area. Clicking the account
          block opens Settings (Billing/Team/Integrations) for managers,
          who no longer have those as separate sidebar nav items. */}
      <div className="flex-shrink-0 border-t-[0.5px] border-hairline pt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => user.role === 'manager' && openSettings()}
          disabled={user.role !== 'manager'}
          className="flex-1 min-w-0 flex items-center gap-2 text-left disabled:cursor-default"
          title={user.role === 'manager' ? 'Account settings' : undefined}
        >
          <Avatar initials={user.initials} tone="accent" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium leading-tight truncate">{user.name}</div>
            <div className="text-[11px] text-label capitalize">{user.role}</div>
          </div>
        </button>
        <button onClick={signOut} title="Sign out" className="text-label hover:text-body flex-shrink-0">
          <Icon name="logout" size={18} />
        </button>
      </div>
    </aside>
  );
}
