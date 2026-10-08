-- Vendra 0011: identify the calling role the way PostgREST actually sets it.
--
-- Two wrong guards, and why
-- ------------------------
--   0007/0009 used current_user. Inside SECURITY DEFINER that is the function
--   OWNER, so it was always 'postgres' and every legitimate call was rejected.
--
--   0010 used session_user. That is the role the connection authenticated as,
--   which in Supabase is always 'authenticator' regardless of the key used,
--   because PostgREST connects as authenticator and then issues SET ROLE.
--
-- The value that actually identifies the caller is the `role` setting, which
-- PostgREST sets with SET LOCAL ROLE from the presented API key and which
-- SECURITY DEFINER deliberately does NOT change. So `current_setting('role')` is
-- 'service_role' for a service-role key, 'authenticated' for a user token, and
-- 'anon' for the public key.
--
-- The guard is now expressed as a helper so there is one definition to get right,
-- and so the failure message names the role that actually connected.

create or replace function public.caller_role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('role', true), ''), current_user);
$$;

comment on function public.caller_role() is
  'The database role the current request is acting as, as set by PostgREST from the API key. Use this rather than current_user (which SECURITY DEFINER replaces with the function owner) or session_user (which is always authenticator on Supabase).';

revoke all on function public.caller_role() from public;
grant execute on function public.caller_role() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- begin_erasure_window
-- ---------------------------------------------------------------------------
create or replace function public.begin_erasure_window()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.caller_role() <> 'service_role' then
    raise exception 'erasure window may only be opened by the service role (acting as %)',
      public.caller_role()
      using errcode = 'insufficient_privilege';
  end if;

  perform set_config('vendra.erasure_window', 'open', true);
end;
$$;

revoke all on function public.begin_erasure_window() from public;
revoke all on function public.begin_erasure_window() from anon;
revoke all on function public.begin_erasure_window() from authenticated;
grant execute on function public.begin_erasure_window() to service_role;

-- ---------------------------------------------------------------------------
-- erase_shop_records
-- ---------------------------------------------------------------------------
create or replace function public.erase_shop_records(p_shop_id uuid)
returns table (
  scope text,
  deleted_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  if public.caller_role() <> 'service_role' then
    raise exception 'erase_shop_records may only be called by the service role (acting as %)',
      public.caller_role()
      using errcode = 'insufficient_privilege';
  end if;

  if p_shop_id is null then
    raise exception 'a shop id is required' using errcode = 'invalid_parameter_value';
  end if;

  -- Transaction-local, so it cannot outlive this call.
  perform set_config('vendra.erasure_window', 'open', true);

  -- Children before parents. deals_supplier_id_fkey does not cascade, so a
  -- supplier cannot be deleted while a surviving deal still references it.
  delete from public.walrus_memory_sync where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'walrus_memory_sync'; deleted_count := v_count; return next;

  delete from public.assistant_messages where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'assistant_messages'; deleted_count := v_count; return next;

  delete from public.assistant_sessions where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'assistant_sessions'; deleted_count := v_count; return next;

  delete from public.evidence_files where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'evidence_files'; deleted_count := v_count; return next;

  -- Reachable only because the window is open in THIS transaction.
  delete from public.deal_events where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'deal_events'; deleted_count := v_count; return next;

  delete from public.deal_lines where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'deal_lines'; deleted_count := v_count; return next;

  delete from public.deals where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'deals'; deleted_count := v_count; return next;

  delete from public.products where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'products'; deleted_count := v_count; return next;

  delete from public.suppliers where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'suppliers'; deleted_count := v_count; return next;

  delete from public.subscriptions where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'subscriptions'; deleted_count := v_count; return next;

  -- Recorded after the deletes, so the erasure itself is still on the log.
  delete from public.audit_events where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'audit_events'; deleted_count := v_count; return next;

  delete from public.data_requests where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'data_requests'; deleted_count := v_count; return next;

  -- Memberships last: a deferred constraint requires an active owner membership
  -- while the shop row still exists.
  delete from public.shop_memberships where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'shop_memberships'; deleted_count := v_count; return next;

  delete from public.shops where id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'shops'; deleted_count := v_count; return next;

  return;
end;
$$;

comment on function public.erase_shop_records(uuid) is
  'Deletes every database row belonging to a shop, atomically, in one transaction. Storage objects are removed separately by the route. Returns per-table counts so the caller reports what actually went.';

revoke all on function public.erase_shop_records(uuid) from public;
revoke all on function public.erase_shop_records(uuid) from anon;
revoke all on function public.erase_shop_records(uuid) from authenticated;
grant execute on function public.erase_shop_records(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Guard against either wrong form coming back.
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  select pg_get_functiondef(p.oid) into fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'erase_shop_records';

  if fn is null then
    raise exception 'erase_shop_records was not created';
  end if;

  if fn not like '%caller_role%' then
    raise exception 'erase_shop_records does not check public.caller_role()';
  end if;

  if fn like '%session_user%' or fn like '%current_user <>%' then
    raise exception 'erase_shop_records uses a role check that does not work under SECURITY DEFINER on Supabase';
  end if;

  if fn not like '%erasure_window%' then
    raise exception 'erase_shop_records does not open the erasure window itself';
  end if;
end
$$;
