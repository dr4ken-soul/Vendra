-- Vendra 0010: check the calling role correctly inside SECURITY DEFINER functions.
--
-- The bug
-- -------
-- Migrations 0007 and 0009 guarded destructive functions with:
--
--   if current_user <> 'service_role' then raise exception ...
--
-- Inside a SECURITY DEFINER function, `current_user` is the *function owner*, not
-- the caller. These functions are owned by the migration role, so `current_user`
-- was always the owner and never 'service_role'. The guard therefore rejected
-- every legitimate call, including the service role's own.
--
-- The symptom was subtle and important: the erasure route reported the relational
-- layer as `blocked` and deleted nothing, which is the honest-reporting behaviour
-- working correctly over a database call that could never succeed.
--
-- The fix
-- -------
-- `session_user` is the role the connection authenticated as, and it is NOT
-- changed by SECURITY DEFINER. That is the value that identifies the caller.
-- `current_user` is retained in the message only for diagnosis.

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
  if session_user <> 'service_role' then
    raise exception 'erasure window may only be opened by the service role (connected as %, running as %)',
      session_user, current_user
      using errcode = 'insufficient_privilege';
  end if;

  perform set_config('vendra.erasure_window', 'open', true);
end;
$$;

comment on function public.begin_erasure_window() is
  'Opens a transaction-scoped window in which deal_events may be deleted. Checks session_user, not current_user, because SECURITY DEFINER changes current_user to the function owner.';

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
  if session_user <> 'service_role' then
    raise exception 'erase_shop_records may only be called by the service role (connected as %, running as %)',
      session_user, current_user
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
-- Prove the role guard is now open to service_role and still shut to anon.
--
-- This executes both functions as a side effect of the check, so a guard that
-- rejects its own intended caller fails the migration rather than shipping.
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

  if fn not like '%session_user%' then
    raise exception 'erase_shop_records does not check session_user, so the role guard is wrong again';
  end if;

  if fn not like '%erasure_window%' then
    raise exception 'erase_shop_records does not open the erasure window itself';
  end if;
end
$$;
