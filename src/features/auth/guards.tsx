import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import type { Role } from '@/types/domain';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useAuth } from './AuthProvider';

const ROLE_LABEL: Record<Role, string> = {
  customer: 'Customer', developer: 'Developer', pm: 'Product Manager', manager: 'Manager', stakeholder: 'Stakeholder',
};

/** One-time "You're in" reveal — rendered above the route tree so it
 * survives the role-change redirect that fires the instant an approved
 * user's role flips away from 'customer'. */
function AccessGrantedOverlay() {
  const { user, dismissApproval } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-navy/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-[400px] bg-surface rounded-frame shadow-pop p-8 text-center">
        <div className="w-11 h-11 mx-auto rounded-full bg-success-bg flex items-center justify-center mb-3">
          <Icon name="check_circle" size={22} className="text-success" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">You're in, {user.name.split(' ')[0]}</h1>
        <p className="text-sm text-body mt-1.5">
          Your {ROLE_LABEL[user.role]} access has been approved. Head to your new workspace.
        </p>
        <Button
          className="w-full h-11 mt-6"
          onClick={() => {
            dismissApproval();
            navigate(roleHome(user.role));
          }}
        >
          Go to my workspace
        </Button>
      </div>
    </div>
  );
}

/** Blocks unauthenticated access; redirects to /signin. */
export function RequireAuth() {
  const { user, loading, justApproved } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/signin" replace />;
  return (
    <>
      <Outlet />
      {justApproved && <AccessGrantedOverlay />}
    </>
  );
}

/** Restricts a subtree to specific roles; others are sent to their home. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/signin" replace />;
  if (!roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return <Outlet />;
}

export function roleHome(role: Role): string {
  switch (role) {
    case 'customer':
      return '/requests';
    case 'developer':
      return '/board';
    case 'pm':
      return '/dashboard';
    case 'manager':
      return '/dashboard';
    case 'stakeholder':
      return '/viewer';
  }
}
