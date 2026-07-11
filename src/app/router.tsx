import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth, RequireRole } from '@/features/auth/guards';
import { RoleIndex } from '@/features/auth/RoleIndex';
import { SignInScreen } from '@/screens/customer/SignInScreen';
import { Placeholder } from '@/screens/Placeholder';

/**
 * Route table. v1 (M0–M3) implements Customer / Developer / PM surfaces.
 * Screens not yet built render <Placeholder> with their milestone tag so the
 * nav + role routing shell is fully walkable today.
 */
export const router = createBrowserRouter([
  { path: '/signin', element: <SignInScreen /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <RoleIndex /> },
      {
        element: <AppShell />,
        children: [
          // Customer (M1)
          {
            element: <RequireRole roles={['customer']} />,
            children: [
              { path: '/submit', element: <Placeholder title="Submit request" milestone="M1" /> },
              { path: '/requests', element: <Placeholder title="My requests" milestone="M1" /> },
              { path: '/requests/:id', element: <Placeholder title="Request detail" milestone="M1" /> },
            ],
          },
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
          // PM (M3)
          {
            element: <RequireRole roles={['pm', 'manager']} />,
            children: [
              { path: '/dashboard', element: <Placeholder title="Dashboard" milestone="M3" /> },
              { path: '/intake', element: <Placeholder title="Intake" milestone="M3" /> },
              { path: '/backlog', element: <Placeholder title="Backlog" milestone="M3" /> },
              { path: '/roadmap', element: <Placeholder title="Roadmap" milestone="M3" /> },
              { path: '/releases', element: <Placeholder title="Release tree" milestone="M3" /> },
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
