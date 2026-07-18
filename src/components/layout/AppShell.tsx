import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/features/auth/AuthProvider';
import { ItemDetailPanel } from '@/components/board/ItemDetailPanel';
import { AsanaOAuthGate } from '@/features/integrations/AsanaOAuthGate';

const ROLE_LABEL: Record<string, string> = {
  customer: 'Customer', developer: 'Developer', pm: 'Product Manager', manager: 'Manager', stakeholder: 'Stakeholder',
};

/**
 * Two-part shell used by all internal role surfaces: a fixed left Sidebar
 * + a flex content column. Individual screens render their own TopNav.
 */
export function AppShell() {
  const { user } = useAuth();
  const pending = user?.status === 'pending';
  return (
    <div className="h-screen w-screen flex overflow-hidden bg-canvas">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {pending && (
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-[#FBF0DD] border-b-[0.5px] border-[#E7CE9B] text-[12px] text-[#8A5A0B]">
            <Icon name="schedule" size={14} />
            <span>
              Your <b>{ROLE_LABEL[user!.requestedRole ?? 'customer']}</b> access is pending approval by an admin in your
              organization. You have Customer access until then.
            </span>
          </div>
        )}
        <Outlet />
      </main>
      <ItemDetailPanel />
      <AsanaOAuthGate />
    </div>
  );
}
