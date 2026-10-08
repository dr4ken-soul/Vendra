-- Vendra 0001: extensions, roles and enumerated domains.
-- Canonical source for typed deal events, membership, evidence metadata and audit records.
-- Reference: DATA_API_CONTRACTS.md

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enumerated domains. Every one of these is enforced by a database constraint
-- so that a malformed value can never reach the application layer.
-- ---------------------------------------------------------------------------

create type public.shop_role as enum ('owner', 'manager', 'staff');

create type public.deal_status as enum (
  'draft',
  'quoted',
  'agreed',
  'part_delivered',
  'delivered',
  'issue_open',
  'resolved',
  'cancelled'
);

create type public.deal_event_type as enum (
  'quote_received',
  'terms_agreed',
  'delivery_checked',
  'issue_opened',
  'resolution_recorded',
  'correction',
  'note_added'
);

create type public.memory_status as enum ('pending', 'active', 'degraded', 'revoked');

create type public.memory_custody_mode as enum (
  'service_managed',
  'retailer_controlled'
);

create type public.memory_sync_status as enum (
  'queued',
  'processing',
  'ready',
  'failed',
  'superseded',
  'deletion_pending'
);

create type public.evidence_extraction_status as enum (
  'not_requested',
  'pending',
  'suggested',
  'confirmed',
  'rejected',
  'failed'
);

create type public.data_request_type as enum ('export', 'erasure');

create type public.data_request_status as enum (
  'received',
  'awaiting_owner_authorisation',
  'in_progress',
  'verifying',
  'complete',
  'blocked'
);

create type public.data_request_scope as enum (
  'relational',
  'evidence_objects',
  'walrus_memory',
  'derived_text'
);

create type public.assistant_role as enum ('user', 'assistant');

-- ---------------------------------------------------------------------------
-- Permissions. `shop_memberships.permissions` stores explicit allowed actions
-- rather than a client-controlled JSON policy blob, so a client cannot widen
-- its own scope by editing a JSON document.
-- ---------------------------------------------------------------------------

create type public.shop_permission as enum (
  'deal.view',
  'deal.create',
  'deal.edit',
  'deal.event',
  'evidence.view',
  'evidence.upload',
  'supplier.manage',
  'assistant.ask',
  'memory.retry',
  'team.view',
  'team.manage',
  'settings.manage',
  'privacy.export',
  'privacy.erase'
);

-- Default permission sets by role. Used when a membership is created.
create or replace function public.default_permissions_for_role(p_role public.shop_role)
returns public.shop_permission[]
language sql
immutable
as $$
  select case p_role
    when 'owner' then array[
      'deal.view','deal.create','deal.edit','deal.event','evidence.view','evidence.upload',
      'supplier.manage','assistant.ask','memory.retry','team.view','team.manage',
      'settings.manage','privacy.export','privacy.erase'
    ]::public.shop_permission[]
    when 'manager' then array[
      'deal.view','deal.create','deal.edit','deal.event','evidence.view','evidence.upload',
      'supplier.manage','assistant.ask','memory.retry','team.view','team.manage',
      'settings.manage','privacy.export'
    ]::public.shop_permission[]
    when 'staff' then array[
      'deal.view','deal.create','deal.event','evidence.view','evidence.upload','assistant.ask'
    ]::public.shop_permission[]
  end;
$$;

comment on function public.default_permissions_for_role(public.shop_role) is
  'Owner holds every permission including privacy.erase. Manager holds every operational permission but cannot authorise shop deletion. Staff hold read/record permissions only.';