-- ProductHub — remove all demo/test data seeded by the earlier 0002_seed.sql.
-- Idempotent: no-ops on a database that was never seeded.
--
-- Delete in FK-safe order: requests (reference profiles via submitted_by) →
-- profiles → demo auth users → workspace → org. Doing it in this order avoids
-- the requests_submitted_by_fkey / workspace-cascade conflict.

-- Requests in the demo workspace (they reference demo profiles).
delete from requests
where workspace_id in (select id from workspaces where name = 'Orion Cloud');

-- Backlog items / notes in the demo workspace (none seeded, but be safe).
delete from backlog_items
where workspace_id in (select id from workspaces where name = 'Orion Cloud');

-- Profiles in the demo workspace.
delete from profiles
where workspace_id in (select id from workspaces where name = 'Orion Cloud');

-- Demo auth users (their profiles are already gone).
delete from auth.users
where email in (
  'customer@orioncloud.com',
  'developer@orioncloud.com',
  'pm@orioncloud.com'
);

-- Finally the workspace + org.
delete from workspaces where name = 'Orion Cloud';
delete from orgs where name = 'Orion Cloud Inc';
