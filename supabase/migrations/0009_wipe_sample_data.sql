-- ProductHub — remove all seeded/sample data across every workspace.
-- Idempotent. Real user accounts, profiles, and workspaces are untouched —
-- only the demo content that seedWorkspace()/earlier seeds inserted.

-- Backlog items with the known sample refs (any workspace).
delete from backlog_items
where ref in ('BUG-0042','FEAT-0024','BUG-0038','BUG-0051','QRY-0017','FEAT-0031');

-- Requests with the known sample refs (any workspace) — cascades are not
-- needed since backlog_items.source_request_id has no FK-cascade delete.
delete from requests
where ref in ('BUG-0042','FEAT-0024','BUG-0038','QRY-0017','QRY-0014');

-- Sample releases/sprints seeded by seedWorkspace().
delete from releases where name in ('Release 4.3', 'Release 4.4');
delete from sprints where name = 'Sprint 24';

-- Sample notifications seeded by seedWorkspace().
delete from notifications
where title in (
  'Welcome to ProductHub',
  '2 requests awaiting triage',
  'BUG-0042 nearing SLA'
);

-- Default automations that were auto-provisioned before this cleanup — remove
-- so the next visit to /automations re-provisions cleanly with zero runs.
delete from automations
where name in (
  'Auto-triage critical bugs',
  'Escalate SLA at risk',
  'Close stale queries',
  'Sync released items to Slack'
);

-- Sample roadmap items, if any workspace has the mock-derived titles.
delete from roadmap_items
where title in (
  'Usage-based billing tier',
  'Automatic Enterprise rate limits',
  'Slack actions on tickets',
  'Bulk import from Asana',
  'Dark mode'
);
