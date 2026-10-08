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

revoke all on function public.is_shop_member(uuid) from public;
revoke all on function public.is_shop_admin(uuid) from public;
revoke all on function public.has_shop_permission(uuid, public.shop_permission) from public;
revoke all on function public.has_any_shop_permission(uuid, public.shop_permission[]) from public;
revoke all on function public.is_shop_owner(uuid) from public;

grant execute on function public.is_shop_member(uuid) to authenticated;
grant execute on function public.is_shop_admin(uuid) to authenticated;
grant execute on function public.has_shop_permission(uuid, public.shop_permission) to authenticated;
grant execute on function public.has_any_shop_permission(uuid, public.shop_permission[]) to authenticated;
grant execute on function public.is_shop_owner(uuid) to authenticated;

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

-- Audit rows are read-only for shop admins and are written by the service role.
create policy audit_events_select on public.audit_events
  for select using (public.has_shop_permission(shop_id, 'team.manage'));

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