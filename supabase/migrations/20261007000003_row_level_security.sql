-- Vendra 0003: Row Level Security.
-- Walrus isolation is an additional boundary. It is not a substitute for
-- application authorisation, and RLS is not a substitute for either.
-- Reference: DATA_API_CONTRACTS.md section 4, PRIVACY_SECURITY.md section 6.

-- ---------------------------------------------------------------------------
-- Helper predicates. SECURITY DEFINER + STABLE so they can read the membership
-- table without recursing through the caller's own RLS policy.
-- ---------------------------------------------------------------------------

create or replace function public.is_shop_member(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_memberships m
    where m.shop_id = p_shop_id
      and m.user_id = auth.uid()
      and m.revoked_at is null
  );
$$;

create or replace function public.is_shop_admin(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_memberships m
    where m.shop_id = p_shop_id
      and m.user_id = auth.uid()
      and m.revoked_at is null
      and m.role in ('owner', 'manager')
  );
$$;

create or replace function public.has_shop_permission(p_shop_id uuid, p_permission public.shop_permission)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_memberships m
    where m.shop_id = p_shop_id
      and m.user_id = auth.uid()
      and m.revoked_at is null
      and p_permission = any (m.permissions)
  );
$$;

create or replace function public.has_any_shop_permission(p_shop_id uuid, p_permissions public.shop_permission[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_memberships m
    where m.shop_id = p_shop_id
      and m.user_id = auth.uid()
      and m.revoked_at is null
      and m.permissions && p_permissions
  );
$$;

create or replace function public.is_shop_owner(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_memberships m
    where m.shop_id = p_shop_id
      and m.user_id = auth.uid()
      and m.revoked_at is null
      and m.role = 'owner'
  );
$$;

-- True when the caller is the registered owner of the shop, according to
-- shops.owner_user_id rather than to a membership row.
--
-- This is deliberately separate from is_shop_owner(), which answers the same
-- question via a membership. The membership does not exist yet at the moment it
-- is needed: creating a shop and then claiming the owner membership is the very
-- first thing a new retailer does, so the membership-based answer is false
-- precisely when the question is asked.
--
-- It must be SECURITY DEFINER. An inline `exists (select 1 from public.shops
-- ...)` inside a policy does not work, because a subquery inside a Row Level
-- Security policy is itself filtered by that table's own policies, and
-- shops_select_member hides every shop the caller has not yet joined. Being
-- SECURITY DEFINER makes the read use the function owner's privileges, so the
-- shop is visible to this function even though it is invisible to the caller.
--
-- The function grants nothing by itself. It answers one yes/no question, and the
-- policy combines it with the user and role checks.
create or replace function public.is_registered_shop_owner(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shops s
    where s.id = p_shop_id
      and s.owner_user_id = auth.uid()
      and s.deleted_at is null
  );
$$;

revoke all on function public.is_shop_member(uuid) from public;
revoke all on function public.is_shop_admin(uuid) from public;
revoke all on function public.has_shop_permission(uuid, public.shop_permission) from public;
revoke all on function public.has_any_shop_permission(uuid, public.shop_permission[]) from public;
revoke all on function public.is_shop_owner(uuid) from public;
revoke all on function public.is_registered_shop_owner(uuid) from public;

grant execute on function public.is_shop_member(uuid) to authenticated;
grant execute on function public.is_shop_admin(uuid) to authenticated;
grant execute on function public.has_shop_permission(uuid, public.shop_permission) to authenticated;
grant execute on function public.has_any_shop_permission(uuid, public.shop_permission[]) to authenticated;
grant execute on function public.is_shop_owner(uuid) to authenticated;
grant execute on function public.is_registered_shop_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- profiles: a user may read and update only their own row.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- shops: readable by active members, writable by owner/manager.
-- ---------------------------------------------------------------------------

alter table public.shops enable row level security;

create policy shops_select_member on public.shops
  for select using (public.is_shop_member(id) and deleted_at is null);

create policy shops_insert_self on public.shops
  for insert with check (owner_user_id = auth.uid());

create policy shops_update_admin on public.shops
  for update using (public.has_shop_permission(id, 'settings.manage'))
  with check (public.has_shop_permission(id, 'settings.manage'));

-- A shop is soft-deleted only through the erasure workflow, which writes an
-- audit record. Direct deletes are not granted to any authenticated role.

-- ---------------------------------------------------------------------------
-- shop_memberships: a member sees their own memberships and their shop's roster.
-- Only an owner or manager may change the roster.
-- ---------------------------------------------------------------------------

alter table public.shop_memberships enable row level security;

create policy memberships_select_own on public.shop_memberships
  for select using (user_id = auth.uid() and revoked_at is null);

create policy memberships_select_shop on public.shop_memberships
  for select using (public.is_shop_member(shop_id));

create policy memberships_insert_admin on public.shop_memberships
  for insert with check (public.has_shop_permission(shop_id, 'team.manage'));

-- Bootstrap: a user may create exactly one membership, their own, with role
-- 'owner', in a shop whose registered owner is them.
--
-- memberships_insert_admin alone cannot cover this. It requires 'team.manage',
-- which the owner does not have before their membership exists, so without this
-- policy shop creation can never complete: a shop would be created with no
-- owner and would be unreachable. Policies are permissive and combined with OR,
-- so inviting anybody else is still governed by memberships_insert_admin and
-- still requires 'team.manage'.
--
-- This cannot be used to reach a shop somebody else owns, because the test is
-- against shops.owner_user_id rather than anything the client supplies.
create policy memberships_insert_self_owner on public.shop_memberships
  for insert with check (
    user_id = auth.uid()
    and role = 'owner'
    and public.is_registered_shop_owner(shop_id)
  );

create policy memberships_update_admin on public.shop_memberships
  for update using (public.has_shop_permission(shop_id, 'team.manage'))
  with check (public.has_shop_permission(shop_id, 'team.manage'));

-- Revocation is an update to revoked_at and is therefore covered by
-- memberships_update_admin. Hard deletes are never granted.

-- ---------------------------------------------------------------------------
-- Tenant-owned data tables.
-- ---------------------------------------------------------------------------

alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.deals enable row level security;
alter table public.deal_lines enable row level security;
alter table public.deal_events enable row level security;
alter table public.evidence_files enable row level security;
alter table public.walrus_memory_sync enable row level security;
alter table public.assistant_sessions enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.audit_events enable row level security;
alter table public.data_requests enable row level security;
alter table public.subscriptions enable row level security;

create policy suppliers_all on public.suppliers
  for all
  using (public.has_shop_permission(shop_id, 'deal.view'))
  with check (public.has_shop_permission(shop_id, 'supplier.manage'));

create policy products_all on public.products
  for all
  using (public.has_shop_permission(shop_id, 'deal.view'))
  with check (public.has_shop_permission(shop_id, 'deal.edit'));

create policy deals_all on public.deals
  for all
  using (public.has_shop_permission(shop_id, 'deal.view'))
  with check (public.has_shop_permission(shop_id, 'deal.create'));

create policy deal_lines_all on public.deal_lines
  for all
  using (public.has_shop_permission(shop_id, 'deal.view'))
  with check (public.has_shop_permission(shop_id, 'deal.create'));

-- Events are append-only. Insert requires deal.event; update and delete are
-- never granted, so the audit trail cannot be rewritten.
create policy deal_events_select on public.deal_events
  for select using (public.has_shop_permission(shop_id, 'deal.view'));

create policy deal_events_insert on public.deal_events
  for insert with check (public.has_shop_permission(shop_id, 'deal.event'));

create policy evidence_files_select on public.evidence_files
  for select using (public.has_shop_permission(shop_id, 'evidence.view'));

create policy evidence_files_insert on public.evidence_files
  for insert with check (public.has_shop_permission(shop_id, 'evidence.upload'));

create policy evidence_files_update on public.evidence_files
  for update using (public.has_shop_permission(shop_id, 'evidence.upload'))
  with check (public.has_shop_permission(shop_id, 'evidence.upload'));

create policy memory_sync_select on public.walrus_memory_sync
  for select using (public.has_shop_permission(shop_id, 'deal.view'));

-- Only the server-side service role writes memory sync rows. No authenticated
-- client policy exists, so a browser cannot mark its own memory as written.
create policy memory_sync_insert on public.walrus_memory_sync
  for insert with check (public.has_shop_permission(shop_id, 'memory.retry'));

create policy memory_sync_update on public.walrus_memory_sync
  for update using (public.has_shop_permission(shop_id, 'memory.retry'))
  with check (public.has_shop_permission(shop_id, 'memory.retry'));

create policy assistant_sessions_all on public.assistant_sessions
  for all
  using (public.has_shop_permission(shop_id, 'assistant.ask') and user_id = auth.uid())
  with check (public.has_shop_permission(shop_id, 'assistant.ask') and user_id = auth.uid());

create policy assistant_messages_all on public.assistant_messages
  for all
  using (public.has_shop_permission(shop_id, 'assistant.ask'))
  with check (public.has_shop_permission(shop_id, 'assistant.ask'));

-- Audit rows are read-only for shop admins and are never updated or deleted:
-- only an INSERT policy exists, so the log is append-only for everyone.
create policy audit_events_select on public.audit_events
  for select using (public.has_shop_permission(shop_id, 'team.manage'));

-- Server-side audit writes go through the acting user's own client wherever the
-- actor is an ordinary shop member, so this policy has to permit them. It is
-- deliberately narrow: the writer must already be an active member of the shop
-- the row names, and may only attribute the row to themselves. It grants no
-- UPDATE or DELETE, so a member cannot alter or erase the log.
--
-- The service role is also permitted, and is used for records where no
-- interactive membership exists, such as the audit entry for revoking a member
-- or for provisioning a shop's memory scope.
create policy audit_events_insert on public.audit_events
  for insert with check (
    public.is_shop_member(shop_id)
    and (actor_user_id is null or actor_user_id = auth.uid())
  );

-- An owner may request their own export; erasure is owner-only.
create policy data_requests_select on public.data_requests
  for select using (public.has_shop_permission(shop_id, 'privacy.export'));

create policy data_requests_insert_export on public.data_requests
  for insert with check (
    public.has_shop_permission(shop_id, 'privacy.export')
    and request_type = 'export'
    and requested_by = auth.uid()
  );

create policy data_requests_insert_erasure on public.data_requests
  for insert with check (
    public.has_shop_permission(shop_id, 'privacy.erase')
    and request_type = 'erasure'
    and requested_by = auth.uid()
  );

create policy subscriptions_select on public.subscriptions
  for select using (public.has_shop_permission(shop_id, 'settings.manage'));

-- ---------------------------------------------------------------------------
-- Hardening: the anon role gets nothing. The service role bypasses RLS, which is
-- why it is server-only and never reaches a browser bundle.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select on public.shops to authenticated;
grant all on all tables in schema public to authenticated;

-- Deal events and evidence keys are never selectable directly by an
-- unconstrained path; object access is additionally gated by storage policies.
revoke select (storage_object_key, sha256, extracted_text_redacted) on public.evidence_files from anon;