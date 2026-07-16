import type { BoardItem, ItemNote, TriageRequest } from './types';

export const MOCK_NOTES: Record<string, ItemNote[]> = {
  b3: [
    { id: 'n1', author: 'Maya T.', initials: 'MT', ago: '2d ago', internal: false, body: "Seeing 429s on the enterprise plan even though we're well under quota. Started after the Tuesday deploy." },
    { id: 'n2', author: 'Sara K.', initials: 'SK', ago: '4h ago', internal: true, body: "Confirmed — the limiter isn't reading the tier override flag. Patch in progress, targeting today's QA build." },
    { id: 'n3', author: 'Ahmed R.', initials: 'AR', ago: '2h ago', internal: true, body: 'Root cause is in the gateway config refactor — linking that PR here.' },
  ],
};

const hAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export const MOCK_BOARD_ITEMS: BoardItem[] = [
  { id: 'b1', ref: 'QRY-0017', title: 'Can we get a dedicated instance in EU region?', type: 'query', boardStatus: 'triaged', priority: 'low', assigneeInitials: 'AR', assigneeName: 'Amir R.', riceScore: 6.4, wsjfScore: 2.3, effort: 3, swimlane: 'Platform', planBucket: 'backlog', createdAt: hAgo(30) },
  { id: 'b2', ref: 'BUG-0038', title: 'Export to CSV missing timezone column', type: 'bug', boardStatus: 'triaged', priority: 'medium', assigneeInitials: 'AR', assigneeName: 'Amir R.', riceScore: 12.1, wsjfScore: 6.0, effort: 2, swimlane: 'Reports', planBucket: 'planned', createdAt: hAgo(20) },
  { id: 'b3', ref: 'BUG-0042', title: 'API rate limit not applying to enterprise tier', type: 'bug', boardStatus: 'in_development', priority: 'critical', assigneeInitials: 'SK', assigneeName: 'Sara K.', riceScore: 18.4, wsjfScore: 8.0, effort: 3, swimlane: 'Platform', planBucket: 'in_cycle', createdAt: hAgo(7.2) },
  { id: 'b4', ref: 'FEAT-0024', title: 'SSO integration with Azure AD', type: 'feature', boardStatus: 'in_development', priority: 'high', assigneeInitials: 'SK', assigneeName: 'Sara K.', riceScore: 14.2, wsjfScore: 3.8, effort: 5, swimlane: 'Platform', planBucket: 'in_cycle', createdAt: hAgo(30) },
  { id: 'b5', ref: 'BUG-0051', title: 'Webhook retries not respecting exponential backoff', type: 'bug', boardStatus: 'in_qa', priority: 'high', assigneeInitials: 'DR', assigneeName: 'Devon R.', riceScore: 9.7, wsjfScore: 4.8, effort: 4, swimlane: 'Integrations', planBucket: 'planned', createdAt: hAgo(19) },
  { id: 'b6', ref: 'FEAT-0031', title: 'Custom SLA tiers per environment', type: 'feature', boardStatus: 'released', priority: 'medium', assigneeInitials: 'SK', assigneeName: 'Sara K.', riceScore: 8.3, wsjfScore: 2.6, effort: 5, swimlane: 'Reports', planBucket: 'backlog', createdAt: hAgo(50) },
];

export const MOCK_TRIAGE_REQUESTS: TriageRequest[] = [
  { id: 't1', ref: 'BUG-0042', type: 'bug', subject: 'API rate limit not applying to enterprise tier', description: 'Seeing 429s on the enterprise plan even though well under quota.', priority: 'critical', product: 'API Gateway', customer: 'Orion Cloud', createdAgo: '12m ago' },
  { id: 't2', ref: 'FEAT-0024', type: 'feature', subject: 'SSO integration with Azure AD', description: 'Need SAML SSO against Azure AD for security review.', priority: 'high', product: 'Platform', customer: 'Orion Cloud', createdAgo: '1h ago' },
  { id: 't3', ref: 'BUG-0038', type: 'bug', subject: 'Export to CSV missing timezone column', description: 'CSV export drops the timezone column.', priority: 'medium', product: 'Reports', customer: 'Nimbus Systems', createdAgo: '3h ago' },
  { id: 't4', ref: 'QRY-0017', type: 'query', subject: 'Can we get a dedicated instance in EU region?', description: 'Data residency requirement for EU customers.', priority: 'low', product: 'Infrastructure', customer: 'Vertex Labs', createdAgo: '6h ago' },
];
