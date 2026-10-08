-- Vendra 0009: perform shop erasure as one atomic database operation.
--
-- Why this exists
-- ---------------
-- Migration 0007 added a transaction-scoped erasure window so deal_events could be
-- deleted without weakening the append-only guarantee. The route opened the
-- window with one request and then issued each delete as a separate request.
-- That cannot work: PostgREST runs every HTTP request in its own transaction, so a
-- transaction-local setting is already gone by the time the next delete arrives.
--
-- The test caught it. Erasure reported `blocked` (the honesty fix from 0007 doing
-- its job) and left every row behind, because the window was never open when the
-- deletes ran.
--
-- The fix
-- -------
-- One function, one transaction. `erase_shop_records` opens the window and
-- performs the whole cascade itself, so the setting and the deletes share a
-- transaction and erasure is atomic: either every row is gone or the transaction
-- rolls back and nothing is lost halfway.
--
-- Storage objects are deliberately NOT handled here. They live in
-- storage.objects, which no business trigger can reach. The route removes them
-- through the Storage API first, then calls this function for the database rows.
--
-- The function returns per-table counts rather than raising, so the route can
-- report exactly what was removed and cannot silently claim success.

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
  -- Restricted to the service role, like every other destructive operation here.
  if current_user <> 'service_role' then
    raise exception 'erase_shop_records may only be called by the service role'
      using errcode = 'insufficient_privilege';
  end if;

  if p_shop_id is null then
    raise exception 'a shop id is required' using errcode = 'invalid_parameter_value';
  end if;

  -- Same transaction-local window the trigger checks.
  perform set_config('vendra.erasure_window', 'open', true);

  -- Children before parents. Most of these foreign keys do not cascade, and
  -- deals_supplier_id_fkey in particular blocks deleting a supplier that a
  -- surviving deal still references.
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

  -- Only reachable because the window is open in THIS transaction.
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

  -- Recorded after the deletes so the erasure itself is still on the log.
  delete from public.audit_events where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'audit_events'; deleted_count := v_count; return next;

  delete from public.data_requests where shop_id = p_shop_id;
  get diagnostics v_count = row_count;
  scope := 'data_requests'; deleted_count := v_count; return next;

  -- Memberships last: a deferred constraint requires the shop to keep an active
  -- owner membership while the shop row exists.
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
  'Deletes every database row belonging to a shop, atomically, opening the erasure window in the same transaction. Storage objects are removed separately by the route. Returns per-table counts so the caller can report what actually went.';

revoke all on function public.erase_shop_records(uuid) from public;
revoke all on function public.erase_shop_records(uuid) from anon;
revoke all on function public.erase_shop_records(uuid) from authenticated;
grant execute on function public.erase_shop_records(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Verify the function is wired the way the route depends on.
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

  -- The window must be opened by this function itself, not left to the caller.
  if fn not like '%erasure_window%' then
    raise exception 'erase_shop_records does not open the erasure window itself';
  end if;

  -- anon must NOT be able to call this. It is a destructive function; a leaked
  -- EXECUTE grant to anon would let anyone erase any shop.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'erase_shop_records'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'anon is able to call erase_shop_records, which would expose shop deletion to everyone';
  end if;

  -- Same for authenticated: no signed-in retailer may erase a shop through RPC.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'erase_shop_records'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) then
    raise exception 'authenticated is able to call erase_shop_records directly';
  end if;

  -- And service_role must be able to, because the route depends on it.
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'erase_shop_records'
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
  ) then
    raise exception 'service_role cannot call erase_shop_records, so the erasure route would fail';
  end if;
end
$$;
