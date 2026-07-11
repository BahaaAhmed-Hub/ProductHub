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
              { path: '/board', element: <Placeholder title="Developer board" milestone="M2" /> },
              { path: '/my-items', element: <Placeholder title="My items" milestone="M2" /> },
              { path: '/triage', element: <Placeholder title="Triage inbox" milestone="M2" /> },
              { path: '/qa', element: <Placeholder title="QA & release" milestone="M2" /> },
              { path: '/sla', element: <Placeholder title="My SLA" milestone="M2" /> },
            ],
          },
          // PM / Manager (M3)
          {
            element: <RequireRole roles={['pm', 'manager']} />,
            children: [
              { path: '/dashboard', element: <Placeholder title="Dashboard" milestone="M3" /> },
              { path: '/intake', element: <Placeholder title="Intake" milestone="M3" /> },
              { path: '/backlog', element: <Placeholder title="Backlog" milestone="M3" /> },
              { path: '/pm/roadmap', element: <Placeholder title="Roadmap" milestone="M3" /> },
              { path: '/pm/releases', element: <Placeholder title="Release tree" milestone="M3" /> },
              { path: '/sprints', element: <Placeholder title="Sprints" milestone="M3" /> },
              { path: '/swimlanes', element: <Placeholder title="Swimlanes" milestone="M3" /> },
              { path: '/automations', element: <Placeholder title="Automations" milestone="M3" /> },
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
