import type { Role } from '@/types/domain';

export interface NavItem {
  label: string;
  icon: string; // Material Symbols name
  path: string;
  badge?: 'inbox' | 'triage'; // dynamic count sources, wired later
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * Per-role sidebar. Paths align with the router.
 * v1 scope (M0–M3) fully covers Customer / Developer / PM. Manager, Stakeholder,
 * Integrations, Research, Prioritization deep-links are stubbed for later milestones.
 */
export const NAV: Record<Role, NavSection[]> = {
  customer: [
    {
      items: [
        { label: 'Submit request', icon: 'add_circle', path: '/submit' },
        { label: 'My requests', icon: 'inbox', path: '/requests' },
        { label: 'Roadmap', icon: 'map', path: '/roadmap' },
        { label: 'Release notes', icon: 'article', path: '/releases' },
      ],
    },
  ],
  developer: [
    {
      title: 'Workspace',
      items: [
        { label: 'Board', icon: 'view_kanban', path: '/board' },
        { label: 'My Items', icon: 'assignment_ind', path: '/my-items' },
        { label: 'Triage Inbox', icon: 'move_to_inbox', path: '/triage', badge: 'triage' },
        { label: 'QA & Release', icon: 'checklist', path: '/qa' },
        { label: 'My SLA', icon: 'schedule', path: '/sla' },
      ],
    },
  ],
  pm: [
    {
      title: 'Overview',
      items: [{ label: 'Dashboard', icon: 'dashboard', path: '/dashboard' }],
    },
    {
      title: 'Planning',
      items: [
        { label: 'Triage Inbox', icon: 'move_to_inbox', path: '/intake', badge: 'triage' },
        { label: 'Backlog', icon: 'format_list_bulleted', path: '/backlog' },
        { label: 'Roadmap', icon: 'map', path: '/pm/roadmap' },
        { label: 'Release Tree', icon: 'account_tree', path: '/pm/releases' },
        { label: 'Sprint / Cycles', icon: 'sprint', path: '/sprints' },
        { label: 'Swimlanes', icon: 'view_week', path: '/swimlanes' },
        { label: 'Automations', icon: 'bolt', path: '/automations' },
      ],
    },
    {
      title: 'Insights',
      items: [
        { label: 'Analytics', icon: 'insights', path: '/analytics' },
        { label: 'Research', icon: 'science', path: '/research' },
        { label: 'Prioritization', icon: 'tune', path: '/prioritize' },
        { label: 'Integrations', icon: 'extension', path: '/integrations' },
      ],
    },
  ],
  // Manager has full PM capability plus oversight — a Manager can do
  // everything a PM can, so this section mirrors `pm` and adds oversight.
  manager: [
    {
      title: 'Oversight',
      items: [
        { label: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
        { label: 'SLA Breaches', icon: 'error', path: '/sla-breaches' },
        { label: 'Customers', icon: 'apartment', path: '/customers' },
        { label: 'Reports', icon: 'summarize', path: '/reports' },
      ],
    },
    {
      title: 'Planning',
      items: [
        { label: 'Triage Inbox', icon: 'move_to_inbox', path: '/intake', badge: 'triage' },
        { label: 'Backlog', icon: 'format_list_bulleted', path: '/backlog' },
        { label: 'Roadmap', icon: 'map', path: '/pm/roadmap' },
        { label: 'Release Tree', icon: 'account_tree', path: '/pm/releases' },
        { label: 'Sprint / Cycles', icon: 'sprint', path: '/sprints' },
        { label: 'Swimlanes', icon: 'view_week', path: '/swimlanes' },
        { label: 'Automations', icon: 'bolt', path: '/automations' },
      ],
    },
    {
      title: 'Insights',
      items: [
        { label: 'Analytics', icon: 'insights', path: '/analytics' },
        { label: 'Research', icon: 'science', path: '/research' },
        { label: 'Prioritization', icon: 'tune', path: '/prioritize' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { label: 'Billing', icon: 'credit_card', path: '/billing' },
        { label: 'Team & Members', icon: 'groups', path: '/team' },
        { label: 'Integrations', icon: 'extension', path: '/integrations' },
      ],
    },
  ],
  stakeholder: [
    { items: [{ label: 'Roadmap', icon: 'map', path: '/viewer' }] },
  ],
};
