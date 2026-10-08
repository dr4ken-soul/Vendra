-- Vendra 0002: core tenant schema.
-- Every tenant-owned table carries shop_id. No public supplier-performance data
-- exists in Vendra by design. Reference: DATA_API_CONTRACTS.md section 2.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  preferred_locale text not null default 'en-NG'
    check (preferred_locale ~ '^[a-z]{2}(-[A-Za-z]{2,4})?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Minimal user profile. display_name is optional and is the only personal field Vendra stores for a user.';

-- ---------------------------------------------------------------------------
-- shops
-- ---------------------------------------------------------------------------

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  market_area text check (market_area is null or char_length(btrim(market_area)) <= 120),
  country_code char(2) not null default 'NG',
  currency_code text not null default 'NGN'
    check (currency_code ~ '^[A-Z]{3}$'),
  timezone text not null default 'Africa/Lagos',

  -- Walrus Memory binding. These columns hold opaque identifiers only.
  -- No private key, delegate secret or signed URL is ever stored here.
  walrus_account_id text,
  walrus_namespace text,
  walrus_owner_address text,
  walrus_delegate_key_ref text,
  memory_custody_mode public.memory_custody_mode not null default 'service_managed',
  memory_status public.memory_status not null default 'pending',
  memory_status_detail text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- A namespace must be unique per shop. Two shops can never share one.
create unique index shops_walrus_namespace_key
  on public.shops (walrus_namespace)
  where walrus_namespace is not null and deleted_at is null;

create unique index shops_live_owner_key
  on public.shops (owner_user_id)
  where deleted_at is null;

comment on column public.shops.walrus_account_id is
  'Opaque Walrus Memory account object identifier. Not a secret.';
comment on column public.shops.walrus_namespace is
  'Tenant namespace. Unique per shop so that one shop can never read another shop''s memories.';
comment on column public.shops.walrus_delegate_key_ref is
  'Reference into the server-side key management system. Never the key material itself.';
comment on column public.shops.memory_custody_mode is
  'service_managed means the operator controls the Walrus owner key and the retailer does not. retailer_controlled means the retailer holds the owner key. The UI copy must match this value exactly.';

-- ---------------------------------------------------------------------------
-- shop_memberships
-- ---------------------------------------------------------------------------

create table public.shop_memberships (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.shop_role not null default 'staff',
  permissions public.shop_permission[] not null
    default public.default_permissions_for_role('staff'),
  invited_by uuid references auth.users (id) on delete set null,
  joined_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index shop_memberships_shop_user_key
  on public.shop_memberships (shop_id, user_id);

create index shop_memberships_user_active_idx
  on public.shop_memberships (user_id)
  where revoked_at is null;

comment on column public.shop_memberships.permissions is
  'Explicit allowed actions. Seeded from default_permissions_for_role and editable only by an owner or manager through the server API.';

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 160),
  phone text check (phone is null or char_length(phone) <= 40),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index suppliers_shop_created_idx on public.suppliers (shop_id, created_at desc);

-- ---------------------------------------------------------------------------
-- products (shop-local labels only; no global catalogue in V1)
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 160),
  category text check (category is null or char_length(category) <= 80),
  unit_label text check (unit_label is null or char_length(unit_label) <= 40),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, shop_id)
);

create index products_shop_created_idx on public.products (shop_id, created_at desc);

-- ---------------------------------------------------------------------------
-- deals
-- ---------------------------------------------------------------------------

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  status public.deal_status not null default 'draft',

  -- Shop-local calendar date. No timezone ambiguity at the day level.
  deal_date date not null default current_date,
  expected_delivery_at timestamptz,
  delivery_note text check (delivery_note is null or char_length(delivery_note) <= 2000),

  external_reference text check (external_reference is null or char_length(external_reference) <= 120),
  currency_code text not null default 'NGN' check (currency_code ~ '^[A-Z]{3}$'),
  headline text check (headline is null or char_length(headline) <= 200),

  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  -- Composite key that lets child tables prove, in the database itself, that
  -- their parent row belongs to the same shop. This closes the cross-tenant
  -- write hole that a plain `references deals(id)` would leave open.
  unique (id, shop_id),
  constraint deals_supplier_same_shop_fk
    foreign key (supplier_id, shop_id)
    references public.suppliers (id, shop_id)
);

alter table public.suppliers add constraint suppliers_id_shop_key unique (id, shop_id);

comment on column public.deals.currency_code is
  'Required on every deal so that a later price can never be silently converted between currencies.';

create index deals_shop_created_idx on public.deals (shop_id, created_at desc);
create index deals_shop_occurred_idx on public.deals (shop_id, deal_date desc);
create index deals_shop_supplier_date_idx on public.deals (shop_id, supplier_id, deal_date desc);
create index deals_shop_status_idx on public.deals (shop_id, status)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- deal_lines
-- ---------------------------------------------------------------------------

create table public.deal_lines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  deal_id uuid not null,
  product_id uuid,

  -- Snapshot of the exact wording used in this deal, so renaming a product
  -- later never rewrites history.
  product_label_snapshot text not null check (char_length(btrim(product_label_snapshot)) between 1 and 160),

  quoted_quantity numeric(14, 3) check (quoted_quantity is null or quoted_quantity > 0),
  agreed_quantity numeric(14, 3) check (agreed_quantity is null or agreed_quantity > 0),
  received_quantity numeric(14, 3) check (received_quantity is null or received_quantity >= 0),

  unit_label text check (unit_label is null or char_length(unit_label) <= 40),

  quoted_unit_price numeric(14, 2) check (quoted_unit_price is null or quoted_unit_price >= 0),
  agreed_unit_price numeric(14, 2) check (agreed_unit_price is null or agreed_unit_price >= 0),

  currency_code text not null default 'NGN' check (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint deal_lines_deal_same_shop_fk
    foreign key (deal_id, shop_id)
    references public.deals (id, shop_id) on delete cascade,
  constraint deal_lines_product_same_shop_fk
    foreign key (product_id, shop_id)
    references public.products (id, shop_id) on delete set null
);

create index deal_lines_deal_idx on public.deal_lines (shop_id, deal_id);
create index deal_lines_shop_created_idx on public.deal_lines (shop_id, created_at desc);

-- ---------------------------------------------------------------------------
-- deal_events (append-only)
-- ---------------------------------------------------------------------------

create table public.deal_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  deal_id uuid not null,
  event_type public.deal_event_type not null,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),

  -- User-confirmed plain-language fact. Never an unconfirmed model guess.
  summary text not null check (char_length(btrim(summary)) between 1 and 2000),

  -- Typed, bounded payload. Columns are explicit rather than unbounded JSON so
  -- that untrusted content cannot smuggle arbitrary structure into the record.
  quoted_total numeric(14, 2) check (quoted_total is null or quoted_total >= 0),
  agreed_total numeric(14, 2) check (agreed_total is null or agreed_total >= 0),
  received_total numeric(14, 2) check (received_total is null or received_total >= 0),
  currency_code text check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  issue_type text check (issue_type is null or char_length(issue_type) <= 80),
  condition text check (condition is null or char_length(condition) <= 80),
  resolution_outcome text check (resolution_outcome is null or char_length(resolution_outcome) <= 1000),
  outcome_code text check (outcome_code is null or char_length(outcome_code) <= 80),

  created_by uuid not null references auth.users (id) on delete restrict,

  -- Correction chain. A correction appends a new event and supersedes the old
  -- one. History is never silently rewritten.
  supersedes_event_id uuid references public.deal_events (id) on delete restrict,
  superseded_at timestamptz,

  constraint deal_events_not_self_supersede check (supersedes_event_id is null or supersedes_event_id <> id),
  constraint deal_events_deal_same_shop_fk
    foreign key (deal_id, shop_id)
    references public.deals (id, shop_id) on delete cascade
);

-- Lets child tables prove that the event they reference is in the same shop.
alter table public.deal_events add constraint deal_events_id_shop_key unique (id, shop_id);

create index deal_events_shop_occurred_idx on public.deal_events (shop_id, occurred_at desc);
create index deal_events_deal_timeline_idx on public.deal_events (deal_id, occurred_at, recorded_at);
create index deal_events_shop_recorded_idx on public.deal_events (shop_id, recorded_at desc);
create index deal_events_supersedes_idx on public.deal_events (supersedes_event_id)
  where supersedes_event_id is not null;

comment on table public.deal_events is
  'Append-only canonical history. Editing a past fact creates a correction event and retains the original.';

-- ---------------------------------------------------------------------------
-- evidence_files (private object storage metadata)
-- ---------------------------------------------------------------------------

create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  deal_id uuid not null,
  event_id uuid,

  storage_object_key text not null,
  content_type text not null check (char_length(content_type) <= 160),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 26214400),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),

  original_filename text not null check (char_length(original_filename) between 1 and 255),
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  uploaded_at timestamptz not null default now(),

  constraint evidence_files_deal_same_shop_fk
    foreign key (deal_id, shop_id)
    references public.deals (id, shop_id) on delete cascade,
  constraint evidence_files_event_same_shop_fk
    foreign key (event_id, shop_id)
    references public.deal_events (id, shop_id) on delete set null
);

  extraction_status public.evidence_extraction_status not null default 'not_requested',
  -- Reviewed text only. Raw unreviewed extraction is never stored.
  extracted_text_redacted text check (extracted_text_redacted is null or char_length(extracted_text_redacted) <= 8000),

  deleted_at timestamptz,
  deleted_object_confirmed_at timestamptz
);

create index evidence_files_deal_idx on public.evidence_files (shop_id, deal_id, uploaded_at desc);
create index evidence_files_event_idx on public.evidence_files (event_id)
  where event_id is not null;
create index evidence_files_shop_created_idx on public.evidence_files (shop_id, created_at desc);

comment on column public.evidence_files.storage_object_key is
  'Private Supabase Storage key. Never a public URL and never written into Walrus Memory.';

-- ---------------------------------------------------------------------------
-- walrus_memory_sync
-- ---------------------------------------------------------------------------

create table public.walrus_memory_sync (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  deal_id uuid not null references public.deals (id) on delete cascade,

  -- Every memory sync row must refer to a canonical event. A memory without a
  -- source event is not eligible to support an answer.
  event_id uuid not null,

  memory_blob_id text,
  namespace text not null,
  job_id text,
  status public.memory_sync_status not null default 'queued',
  memory_version integer not null default 1 check (memory_version > 0),
  supersedes_sync_id uuid references public.walrus_memory_sync (id) on delete set null,

  -- Only the concise, evidence-anchored statement. Never a receipt image,
  -- contact detail, signed URL or chat transcript.
  memory_text text check (memory_text is null or char_length(memory_text) <= 1200),

  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 80),
  last_error_at timestamptz,
  -- Whether this version has been observed to succeed in a later recall.
  verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint walrus_memory_sync_deal_same_shop_fk
    foreign key (deal_id, shop_id)
    references public.deals (id, shop_id) on delete cascade,
  constraint walrus_memory_sync_event_same_shop_fk
    foreign key (event_id, shop_id)
    references public.deal_events (id, shop_id) on delete cascade
);

create unique index walrus_memory_sync_event_key
  on public.walrus_memory_sync (event_id, memory_version);

create index walrus_memory_sync_shop_status_idx
  on public.walrus_memory_sync (shop_id, status, created_at desc);
create index walrus_memory_sync_job_idx on public.walrus_memory_sync (job_id)
  where job_id is not null;

comment on table public.walrus_memory_sync is
  'Audit link between a Walrus memory write and the canonical deal event that produced it. Never holds key material or private URLs.';

-- ---------------------------------------------------------------------------
-- assistant_sessions / assistant_messages
-- ---------------------------------------------------------------------------

create table public.assistant_sessions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text check (title is null or char_length(title) <= 160),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  archived_at timestamptz
);

create index assistant_sessions_shop_idx
  on public.assistant_sessions (shop_id, last_message_at desc)
  where archived_at is null;

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  session_id uuid not null references public.assistant_sessions (id) on delete cascade,
  role public.assistant_role not null,
  content text not null check (char_length(content) between 1 and 8000),

  -- Whether the assistant grounded its answer in canonical records.
  grounded boolean not null default false,
  source_event_ids uuid[] not null default '{}',
  source_evidence_ids uuid[] not null default '{}',
  memory_status text check (memory_status is null or char_length(memory_status) <= 40),

  created_at timestamptz not null default now()
);

create index assistant_messages_session_idx
  on public.assistant_messages (session_id, created_at);

comment on table public.assistant_messages is
  'Conversation continuation only. Durable memory is always represented by a reviewed deal_event plus a walrus_memory_sync row, never by this transcript.';

-- ---------------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  target_type text check (target_type is null or char_length(target_type) <= 60),
  target_id uuid,
  -- Minimal metadata only. Deal content is never copied into the audit log.
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index audit_events_shop_created_idx on public.audit_events (shop_id, created_at desc);
create index audit_events_action_idx on public.audit_events (action, created_at desc);

-- ---------------------------------------------------------------------------
-- data_requests (export / erasure)
-- ---------------------------------------------------------------------------

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete restrict,
  request_type public.data_request_type not null,

  -- One row per data class so a blocked layer can be reported truthfully
  -- without claiming the whole request completed.
  scope public.data_request_scope not null,
  status public.data_request_status not null default 'received',

  walrus_blob_ids uuid[] not null default '{}',
  detail text check (detail is null or char_length(detail) <= 2000),
  blocked_reason text check (blocked_reason is null or char_length(blocked_reason) <= 1000),

  result_object_key text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,

  unique (shop_id, request_type, scope, requested_at)
);

create index data_requests_shop_idx on public.data_requests (shop_id, requested_at desc);
create index data_requests_open_idx on public.data_requests (shop_id, status)
  where status not in ('complete');

comment on column public.data_requests.scope is
  'Tracked per data class so that a layer which cannot be verified is reported as blocked rather than silently counted as erased.';

-- ---------------------------------------------------------------------------
-- subscriptions (structure only; billing is not enabled in the challenge MVP)
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  provider text not null default 'paystack',
  provider_reference text,
  plan text check (plan in ('pilot', 'solo', 'team', 'multi_shop')),
  status text not null default 'inactive',
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  currency_code char(3) not null default 'NGN',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Card details are never stored. Only a provider reference and status.
create unique index subscriptions_shop_provider_key
  on public.subscriptions (shop_id, provider, provider_reference)
  where provider_reference is not null;
create index subscriptions_shop_idx on public.subscriptions (shop_id);

comment on table public.subscriptions is
  'Billing is not enabled in the challenge MVP. No card data is ever stored; only a provider reference and status.';