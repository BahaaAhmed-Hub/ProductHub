import { useAuth } from '@/features/auth/AuthProvider';
import { DashboardScreen } from '@/screens/pm/DashboardScreen';
import { ManagerDashboard } from '@/screens/manager/ManagerDashboard';

/** /dashboard is shared by PM and Manager — render the right one for the role. */
export function RoleDashboard() {
  const { user } = useAuth();
  return user?.role === 'manager' ? <ManagerDashboard /> : <DashboardScreen />;
}
