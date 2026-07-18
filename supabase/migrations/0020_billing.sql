-- ProductHub — subscription billing (Stripe). orgs had RLS enabled since
-- 0001_init.sql but never got a policy, so it's been unreadable/unwritable
-- through the normal client entirely — fixing that here as part of wiring
-- billing, since the Billing screen needs to read/update it directly.

alter table orgs add column if not exists stripe_customer_id text;
create unique index if not exists orgs_stripe_customer_uniq on orgs(stripe_customer_id) where stripe_customer_id is not null;

drop policy if exists orgs_read on orgs;
create policy orgs_read on orgs for select
  using (id in (select org_id from workspaces where id = current_workspace()));

-- Plan/subscription state is always re-derived live from Stripe (no
-- webhook — see stripe-status), so the only column callers write here is
-- stripe_customer_id; still gated to Manager + own org either way.
drop policy if exists orgs_manage on orgs;
create policy orgs_manage on orgs for update
  using (id in (select org_id from workspaces where id = current_workspace()) and current_role_is(array['manager']::role[]))
  with check (id in (select org_id from workspaces where id = current_workspace()));
