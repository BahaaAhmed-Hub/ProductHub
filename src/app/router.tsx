import { createHashRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { RequireAuth, RequireRole } from '@/features/auth/guards';
import { RoleIndex } from '@/features/auth/RoleIndex';
import { SignInScreen } from '@/screens/customer/SignInScreen';
import { SubmitRequestScreen } from '@/screens/customer/SubmitRequestScreen';
import { ConfirmationScreen } from '@/screens/customer/ConfirmationScreen';
import { MyRequestsScreen } from '@/screens/customer/MyRequestsScreen';
import { RequestDetailScreen } from '@/screens/customer/RequestDetailScreen';
import { PublicRoadmapScreen } from '@/screens/customer/PublicRoadmapScreen';
import { ReleaseNotesScreen } from '@/screens/customer/ReleaseNotesScreen';
import { BoardScreen } from '@/screens/developer/BoardScreen';
import { TriageInboxScreen } from '@/screens/developer/TriageInboxScreen';
import { ItemDetailScreen } from '@/screens/developer/ItemDetailScreen';
import { QAReleaseScreen } from '@/screens/developer/QAReleaseScreen';
import { MySLAScreen } from '@/screens/developer/MySLAScreen';
import { DashboardScreen } from '@/screens/pm/DashboardScreen';
import { BacklogScreen } from '@/screens/pm/BacklogScreen';
import { RoadmapScreen } from '@/screens/pm/RoadmapScreen';
import { AutomationsScreen } from '@/screens/pm/AutomationsScreen';
import { Placeholder } from '@/screens/Placeholder';

/**
 * Route table. M1 (Customer support flow) is fully implemented; Developer (M2)
 * and PM (M3) surfaces are stubbed with milestone-tagged placeholders so the
 * role-routing shell is walkable end-to-end today.
 */
export const router = createHashRouter([
  { path: '/signin', element: <SignInScreen /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <RoleIndex /> },

      // ---- Customer (M1) ----
      {
        element: <RequireRole roles={['customer']} />,
        children: [
          {
            element: <CustomerLayout />,
            children: [
              { path: '/submit', element: <SubmitRequestScreen /> },
              { path: '/requests', element: <MyRequestsScreen /> },
              { path: '/requests/:id', element: <RequestDetailScreen /> },
            ],
          },
          { path: '/submitted', element: <ConfirmationScreen /> },
          {
            element: <PublicLayout />,
            children: [
              { path: '/roadmap', element: <PublicRoadmapScreen /> },
              { path: '/releases', element: <ReleaseNotesScreen /> },
            ],
          },
        ],
      },

      // ---- Internal roles: sidebar shell ----
      {
        element: <AppShell />,
        children: [
          // Developer (M2)
          {
            element: <RequireRole roles={['developer']} />,
            children: [
              { path: '/board', element: <BoardScreen /> },
              { path: '/triage', element: <TriageInboxScreen /> },
              { path: '/items/:id', element: <ItemDetailScreen /> },
              { path: '/my-items', element: <MySLAScreen /> },
              { path: '/qa', element: <QAReleaseScreen /> },
              { path: '/sla', element: <MySLAScreen /> },
            ],
          },
          // PM / Manager (M3)
          {
            element: <RequireRole roles={['pm', 'manager']} />,
            children: [
              { path: '/dashboard', element: <DashboardScreen /> },
              { path: '/intake', element: <TriageInboxScreen /> },
              { path: '/backlog', element: <BacklogScreen /> },
              { path: '/pm/roadmap', element: <RoadmapScreen /> },
              { path: '/pm/releases', element: <Placeholder title="Release tree" milestone="M3" /> },
              { path: '/sprints', element: <BoardScreen /> },
              { path: '/swimlanes', element: <Placeholder title="Swimlanes" milestone="M3" /> },
              { path: '/automations', element: <AutomationsScreen /> },
              { path: '/analytics', element: <Placeholder title="Analytics (Lens)" milestone="M6" /> },
              { path: '/research', element: <Placeholder title="Research hub" milestone="M7" /> },
              { path: '/prioritize', element: <Placeholder title="Prioritization" milestone="M4" /> },
              { path: '/integrations', element: <Placeholder title="Integrations" milestone="M8" /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
