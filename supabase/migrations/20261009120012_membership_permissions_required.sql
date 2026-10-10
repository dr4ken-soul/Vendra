-- 00012: shop_memberships.permissions must be stated, never defaulted
--
-- Why
--
-- `permissions` had a column default of `default_permissions_for_role('staff')`.
-- Role and permissions are independent columns, so a row inserted with
-- `role = 'owner'` and no explicit permissions became an owner holding the *staff*
-- permission set: no settings.manage, no team.manage, no privacy.erase.
--
-- Both application insert sites pass permissions explicitly
-- (`src/app/api/shops/route.ts` and `src/app/api/team/route.ts`), so no real
-- membership is affected by this. The hazard is for anything else that writes the
-- table — a seed script, a migration, a support tool.
--
-- It fails quietly and it fails confusingly. The owner-only erasure endpoint
-- reports "Only the shop owner can request deletion of this shop's data", which
-- reads as an authorisation bug rather than as a missing column. Worse, it
-- deadlocks cleanup: erasure needs privacy.erase, which the row lacks, and
-- deleting the account is blocked by the very rows erasure would remove. That
-- exact deadlock happened while seeding a demo shop.
--
-- What
--
-- Drop the default and require the column. An insert that forgets permissions now
-- fails loudly at write time instead of producing a silently under-privileged
-- membership. Existing rows are untouched: the default only applies to inserts
-- that omit the column.

alter table public.shop_memberships
  alter column permissions drop default;

comment on column public.shop_memberships.permissions is
  'Effective permissions for this member. No default on purpose: a default of '
  'default_permissions_for_role(''staff'') silently produced owners with staff '
  'rights when a caller set role without setting permissions, which broke '
  'owner-only actions and deadlocked account removal. Call '
  'default_permissions_for_role(role) explicitly.';

comment on column public.shop_memberships.role is
  'Shop role. Informational alongside permissions: authorisation checks read the '
  'permissions array, not this column, so role and permissions must be set '
  'together and consistently.';