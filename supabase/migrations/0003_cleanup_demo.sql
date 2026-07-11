-- ProductHub — remove all demo/test data seeded by the earlier 0002_seed.sql.
-- Idempotent: no-ops on a database that was never seeded.
--
-- Deleting the demo auth users cascades to their profiles (profiles.auth_uid
-- ON DELETE CASCADE). Deleting the Orion Cloud workspace cascades to its
-- requests and any remaining profiles. Org is removed last.

delete from auth.users
where email in (
  'customer@orioncloud.com',
  'developer@orioncloud.com',
  'pm@orioncloud.com'
);

delete from workspaces where name = 'Orion Cloud';
delete from orgs where name = 'Orion Cloud Inc';
