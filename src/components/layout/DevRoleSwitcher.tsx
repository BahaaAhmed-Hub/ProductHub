import { useNavigate } from 'react-router-dom';
import type { Role } from '@/types/domain';
import { useAuth } from '@/features/auth/AuthProvider';
import { roleHome } from '@/features/auth/guards';

const ROLES: Role[] = ['customer', 'developer', 'pm', 'manager', 'stakeholder'];

/** Dev-only floating control to preview each role's surface while in mock mode. */
export function DevRoleSwitcher() {
  const { user, mockMode, setMockRole } = useAuth();
  const navigate = useNavigate();
  if (!mockMode || !user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 bg-navy text-white/90 rounded-full px-1.5 py-1 shadow-pop">
      <span className="text-[10px] uppercase tracking-wide px-2 text-white/60">Role</span>
      {ROLES.map((r) => (
        <button
          key={r}
          onClick={() => {
            setMockRole(r);
            navigate(roleHome(r));
          }}
          className={`text-[11px] capitalize px-2.5 h-6 rounded-full transition-colors ${
            user.role === r ? 'bg-white text-navy font-medium' : 'hover:bg-white/10'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
