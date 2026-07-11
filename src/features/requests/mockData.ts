import type { CustomerRequest } from './types';

/** Seed requests for the customer surface (mock mode). Mirrors screens 04–06. */
export const MOCK_REQUESTS: CustomerRequest[] = [
  {
    id: 'r-0042',
    ref: 'BUG-0042',
    type: 'bug',
    subject: 'API rate limit not applying to enterprise tier',
    description:
      "Seeing 429s on the enterprise plan even though we're well under quota. Started after the Tuesday deploy.",
    priority: 'high',
    product: 'API Gateway',
    status: 'in_progress',
    plannedRelease: 'Release 4.3 · Aug',
    submittedByName: 'Maya T.',
    submittedOn: 'Jun 24',
    updatedAgo: '2h ago',
    slaLeft: '4h 12m left',
    attachments: [{ name: 'rate-limit-console.png', size: '248 KB' }],
    conversation: [
      {
        authorId: 'u-cust',
        authorName: 'You',
        isTeam: false,
        initials: 'MT',
        timeAgo: '3d ago',
        body: "Seeing 429s on the enterprise plan even though we're well under quota. Started after the Tuesday deploy.",
        attachment: { name: 'rate-limit-console.png', size: '248 KB' },
      },
      {
        authorId: 'u-dev',
        authorName: 'Sara K.',
        isTeam: true,
        initials: 'SK',
        timeAgo: '4h ago',
        body: "Thanks Maya — reproduced it. The limiter isn't reading the enterprise tier override; a fix is in progress and targeting today's build. We'll update you the moment it ships.",
      },
    ],
  },
  {
    id: 'r-0024',
    ref: 'FEAT-0024',
    type: 'feature',
    subject: 'SSO integration with Azure AD',
    description: 'Need SAML SSO against Azure AD for our security review.',
    priority: 'high',
    product: 'Platform',
    status: 'in_progress',
    plannedRelease: 'Release 4.4 · Sep',
    submittedByName: 'Priya N.',
    submittedOn: 'Jun 18',
    updatedAgo: '1d ago',
    attachments: [],
    conversation: [],
  },
  {
    id: 'r-0038',
    ref: 'BUG-0038',
    type: 'bug',
    subject: 'Export to CSV missing timezone column',
    description: 'CSV export drops the timezone column present in the UI table.',
    priority: 'medium',
    product: 'Reports',
    status: 'received',
    submittedByName: 'Maya T.',
    submittedOn: 'Jun 20',
    updatedAgo: '3d ago',
    attachments: [],
    conversation: [],
  },
  {
    id: 'r-0014',
    ref: 'QRY-0014',
    type: 'query',
    subject: 'How to configure role-based access for sub-accounts?',
    description: 'Looking for docs on RBAC across sub-accounts.',
    priority: 'low',
    product: 'Platform',
    status: 'resolved',
    submittedByName: 'Devon R.',
    submittedOn: 'Jun 12',
    updatedAgo: '6d ago',
    attachments: [],
    conversation: [],
  },
  {
    id: 'r-0017',
    ref: 'QRY-0017',
    type: 'query',
    subject: 'Can we get a dedicated instance in EU region?',
    description: 'Data residency requirement for EU customers.',
    priority: 'low',
    product: 'Infrastructure',
    status: 'received',
    submittedByName: 'Maya T.',
    submittedOn: 'Jun 8',
    updatedAgo: '6d ago',
    attachments: [],
    conversation: [],
  },
];

export interface NotificationRow {
  id: string;
  body: string;
  timeAgo: string;
  unread: boolean;
}

export const MOCK_NOTIFICATIONS: NotificationRow[] = [
  { id: 'n1', body: 'Sara K. replied to BUG-0042', timeAgo: '2h ago', unread: true },
  { id: 'n2', body: 'FEAT-0024 status changed to In progress', timeAgo: '1d ago', unread: false },
  { id: 'n3', body: 'QRY-0014 marked Resolved', timeAgo: '3d ago', unread: false },
];

export interface RoadmapColumn {
  bucket: 'now' | 'next' | 'later';
  label: string;
  sub: string;
  dot: string;
  items: { title: string; body: string; ghost?: boolean }[];
}

export const MOCK_PUBLIC_ROADMAP: RoadmapColumn[] = [
  {
    bucket: 'now',
    label: 'Now',
    sub: 'This quarter',
    dot: '#1B2A4A',
    items: [
      {
        title: 'Usage-based billing tier',
        body: "Pricing that scales with your support team's actual usage, not seat count.",
      },
      {
        title: 'Automatic Enterprise rate limits',
        body: 'No more manually requesting a rate-limit override.',
      },
    ],
  },
  {
    bucket: 'next',
    label: 'Next',
    sub: 'Next quarter',
    dot: '#D97706',
    items: [
      {
        title: 'Slack actions on tickets',
        body: 'Acknowledge, reassign, and resolve tickets without leaving Slack.',
      },
      {
        title: 'Bulk import from Asana',
        body: 'Bring an entire Asana workspace over in one pass.',
      },
    ],
  },
  {
    bucket: 'later',
    label: 'Later',
    sub: 'Exploring',
    dot: '#8A8983',
    items: [
      { title: 'Dark mode', body: 'For the agent workspace.' },
      { title: 'More being scoped…', body: '', ghost: true },
    ],
  },
];

export interface ReleaseNote {
  version: string;
  when: string;
  title: string;
  bullets: string[];
}

export const MOCK_RELEASE_NOTES: ReleaseNote[] = [
  {
    version: 'Release 4.3',
    when: 'Shipped today',
    title: 'Enterprise rate-limit reliability',
    bullets: [
      'Fixed the API rate limiter ignoring the Enterprise tier override',
      'Corrected a missing timezone column on CSV exports',
      'Enterprise customers should see 429 errors drop to zero under normal usage',
    ],
  },
  {
    version: 'Release 4.2',
    when: '2 weeks ago',
    title: 'Faster ticket search & saved views',
    bullets: [
      'Search results now return in under 200ms on large backlogs',
      'Save and share custom filtered views with your team',
    ],
  },
  {
    version: 'Release 4.1',
    when: '3 weeks ago',
    title: 'Asana & Slack integrations',
    bullets: [
      'Import projects and tasks directly from Asana',
      'Post ticket updates to Slack and act on them without leaving the channel',
    ],
  },
];
