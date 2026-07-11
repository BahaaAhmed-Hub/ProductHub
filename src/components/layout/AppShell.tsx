import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { DevRoleSwitcher } from './DevRoleSwitcher';

/**
 * Two-part shell used by all internal role surfaces: a fixed left Sidebar
 * + a flex content column. Individual screens render their own TopNav so
 * the center/actions can vary per screen (matching the mockups).
 */
export function AppShell() {
  return (
    <div className="h-screen w-screen flex overflow-hidden bg-canvas">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </main>
      <DevRoleSwitcher />
    </div>
  );
}
