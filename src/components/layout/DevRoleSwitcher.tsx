import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Role } from '@/types/domain';
import { useAuth } from '@/features/auth/AuthProvider';
import { roleHome } from '@/features/auth/guards';

const ROLES: Role[] = ['customer', 'developer', 'pm', 'manager', 'stakeholder'];

/**
 * Owner "View as" control — switch which role surface you're operating in.
 * In real mode this persists your profile role (RLS-guarded self-update); in
 * mock mode it swaps the seeded user. A stand-in until proper team/role
 * management (invites) ships.
 */
export function DevRoleSwitcher() {
  const { user, switchRole } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  async function pick(r: Role) {
    if (r === user!.role || busy) return;
    setBusy(true);
    try {
      await switchRole(r);
      navigate(roleHome(r));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 bg-navy text-white/90 rounded-full px-1.5 py-1 shadow-pop">
      <span className="text-[10px] uppercase tracking-wide px-2 text-white/60">View as</span>
      {ROLES.map((r) => (
        <button
          key={r}
          onClick={() => pick(r)}
          disabled={busy}
          className={`text-[11px] capitalize px-2.5 h-6 rounded-full transition-colors disabled:opacity-60 ${
            user.role === r ? 'bg-white text-navy font-medium' : 'hover:bg-white/10'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
