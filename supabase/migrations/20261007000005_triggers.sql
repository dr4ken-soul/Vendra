-- Vendra 0005: triggers, invariants and audit helpers.
-- Reference: DATA_API_CONTRACTS.md section 3.

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger shops_touch before update on public.shops
  for each row execute function public.touch_updated_at();
create trigger suppliers_touch before update on public.suppliers
  for each row execute function public.touch_updated_at();
create trigger deal_lines_touch before update on public.deal_lines
  for each row execute function public.touch_updated_at();
create trigger memory_sync_touch before update on public.walrus_memory_sync
  for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Profile provisioning: every authenticated user gets exactly one profile row.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Invariant: a shop always has exactly one live owner membership, and that
-- membership belongs to shops.owner_user_id. Enforced on the membership table
-- so that revoking the owner's access cannot leave a shop unreachable.
-- ---------------------------------------------------------------------------

create or replace function public.assert_shop_has_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_shop uuid;
  shop_owner uuid;
begin
  target_shop := coalesce(new.shop_id, old.shop_id);
  select s.owner_user_id into shop_owner
  from public.shops s where s.id = target_shop;

  -- Fires after the fact for revoke/insert; only assert the invariant when a
  -- membership becomes active.
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.revoked_at is null and old.revoked_at is not null) then
    if not exists (
      select 1 from public.shop_memberships m
      where m.shop_id = target_shop
        and m.role = 'owner'
        and m.user_id = shop_owner
        and m.revoked_at is null
        and (tg_op = 'UPDATE' or m.id <> new.id or m.revoked_at is null)
    ) then
      raise exception 'shop % would have no active owner membership', target_shop
        using errcode = 'check_violation';
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger shop_memberships_require_owner
  after insert or update of revoked_at on public.shop_memberships
  deferrable initially deferred
  for each row execute function public.assert_shop_has_owner();

-- ---------------------------------------------------------------------------
-- Deal status may only advance through the event lifecycle. This prevents a
-- write from setting `resolved` with no resolution event behind it.
-- ---------------------------------------------------------------------------

create or replace function public.assert_deal_status_has_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  required_type public.deal_event_type;
begin
  case new.status
    when 'agreed' then required_type := 'terms_agreed';
    when 'part_delivered', 'delivered' then required_type := 'delivery_checked';
    when 'issue_open' then required_type := 'issue_opened';
    when 'resolved' then required_type := 'resolution_recorded';
    else return null;
  end case;

  if old.status is distinct from new.status then
    if not exists (
      select 1 from public.deal_events e
      where e.deal_id = new.id
        and e.shop_id = new.shop_id
        and e.event_type = required_type
        and e.superseded_at is null
    ) then
      raise exception 'deal % cannot move to % without a current % event', new.id, new.status, required_type
        using errcode = 'check_violation';
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger deals_require_lifecycle_event
  after update of status on public.deals
  deferrable initially deferred
  for each row execute function public.assert_deal_status_has_event();

-- ---------------------------------------------------------------------------
-- Append-only protection. deal_events is the audit trail; a correction creates
-- a new row. These triggers make a silent rewrite impossible even for the
-- service role.
-- ---------------------------------------------------------------------------

create or replace function public.deny_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'deal_events is append-only; record a correction event instead'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger deal_events_no_update
  before update on public.deal_events
  for each row when (old.superseded_at is null and old.summary = new.summary)
  execute function public.deny_event_mutation();

create trigger deal_events_no_delete
  before delete on public.deal_events
  for each row execute function public.deny_event_mutation();

-- ---------------------------------------------------------------------------
-- A memory sync row must always point at a canonical, non-superseded event in
-- the same shop. This is the invariant that makes recall trustworthy.
-- ---------------------------------------------------------------------------

create or replace function public.assert_memory_has_live_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.deal_events e
    where e.id = new.event_id
      and e.shop_id = new.shop_id
      and e.deal_id = new.deal_id
  ) then
    raise exception 'memory sync row must reference a canonical event in the same shop'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger memory_sync_requires_source
  before insert or update of event_id, shop_id, deal_id on public.walrus_memory_sync
  for each row execute function public.assert_memory_has_live_source();

-- ---------------------------------------------------------------------------
-- Audit helper used by the server API.
-- ---------------------------------------------------------------------------

create or replace function public.write_audit_event(
  p_shop_id uuid,
  p_action text,
  p_target_type text default null,
  p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_events (shop_id, actor_user_id, action, target_type, target_id, metadata)
  values (p_shop_id, auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
$$;

revoke all on function public.write_audit_event(uuid, text, text, uuid, jsonb) from public;
grant execute on function public.write_audit_event(uuid, text, text, uuid, jsonb) to authenticated;