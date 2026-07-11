import { Navigate, Outlet } from 'react-router-dom';
import type { Role } from '@/types/domain';
import { useAuth } from './AuthProvider';

/** Blocks unauthenticated access; redirects to /signin. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/signin" replace />;
  return <Outlet />;
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
