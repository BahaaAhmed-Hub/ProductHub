import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { roleHome } from './guards';

/** Sends an authenticated user to their role's home screen. */
export function RoleIndex() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/signin" replace />;
  return <Navigate to={roleHome(user.role)} replace />;
}
