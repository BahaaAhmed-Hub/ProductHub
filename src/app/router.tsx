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
import { BacklogScreen } from '@/screens/pm/BacklogScreen';
import { RoadmapScreen } from '@/screens/pm/RoadmapScreen';
import { AutomationsScreen } from '@/screens/pm/AutomationsScreen';
import { PrioritizationHub } from '@/screens/pm/prioritization/PrioritizationHub';
import { ValueEffortScreen } from '@/screens/pm/prioritization/ValueEffortScreen';
import { MoscowScreen } from '@/screens/pm/prioritization/MoscowScreen';
import { RoleDashboard } from '@/screens/RoleDashboard';
import { AnalyticsHome } from '@/screens/analytics/AnalyticsHome';
import { IntegrationsScreen } from '@/screens/pm/IntegrationsScreen';
import { ResearchHub } from '@/screens/pm/ResearchHub';
import { StakeholderViewer } from '@/screens/stakeholder/StakeholderViewer';
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

      // ---- Stakeholder (read-only viewer) ----
      {
        element: <RequireRole roles={['stakeholder']} />,
        children: [{ path: '/viewer', element: <StakeholderViewer /> }],
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
              { path: '/dashboard', element: <RoleDashboard /> },
              { path: '/intake', element: <TriageInboxScreen /> },
              { path: '/backlog', element: <BacklogScreen /> },
              // Manager oversight (M5)
              { path: '/sla-breaches', element: <Placeholder title="SLA breaches" milestone="M5" /> },
              { path: '/team', element: <Placeholder title="Team performance" milestone="M5" /> },
              { path: '/reports', element: <Placeholder title="Reports" milestone="M5" /> },
              { path: '/pm/roadmap', element: <RoadmapScreen /> },
              { path: '/pm/releases', element: <Placeholder title="Release tree" milestone="M3" /> },
              { path: '/sprints', element: <BoardScreen /> },
              { path: '/swimlanes', element: <Placeholder title="Swimlanes" milestone="M3" /> },
              { path: '/automations', element: <AutomationsScreen /> },
              { path: '/analytics', element: <AnalyticsHome /> },
              { path: '/research', element: <ResearchHub /> },
              { path: '/prioritize', element: <PrioritizationHub /> },
              { path: '/prioritize/value-effort', element: <ValueEffortScreen /> },
              { path: '/prioritize/moscow', element: <MoscowScreen /> },
              { path: '/prioritize/wsjf', element: <Placeholder title="WSJF scoring" milestone="M4" /> },
              { path: '/prioritize/custom', element: <Placeholder title="Custom model" milestone="M4" /> },
              { path: '/prioritize/results', element: <Placeholder title="Prioritization results" milestone="M4" /> },
              { path: '/integrations', element: <IntegrationsScreen /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
