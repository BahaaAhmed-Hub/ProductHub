import type { Role, User } from '@/types/domain';

/** Seed users for mock-mode development (one per role). Replaced by Supabase profiles once wired. */
export const MOCK_USERS: Record<Role, User> = {
  customer: {
    id: 'u-cust',
    workspaceId: 'ws-orion',
    name: 'Maya T.',
    email: 'maya.t@orioncloud.com',
    role: 'customer',
    initials: 'MT',
  },
  developer: {
    id: 'u-dev',
    workspaceId: 'ws-orion',
    name: 'Sara K.',
    email: 'sara.k@flowdesk.io',
    role: 'developer',
    initials: 'SK',
  },
  pm: {
    id: 'u-pm',
    workspaceId: 'ws-orion',
    name: 'Nour M.',
    email: 'nour.m@flowdesk.io',
    role: 'pm',
    initials: 'NM',
  },
  manager: {
    id: 'u-mgr',
    workspaceId: 'ws-orion',
    name: 'Omar F.',
    email: 'omar.f@flowdesk.io',
    role: 'manager',
    initials: 'OF',
  },
  stakeholder: {
    id: 'u-stk',
    workspaceId: 'ws-orion',
    name: 'Layla H.',
    email: 'layla.h@partner.com',
    role: 'stakeholder',
    initials: 'LH',
  },
};
