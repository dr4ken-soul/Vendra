-- Vendra 0007: make the erasure path possible without weakening append-only.
--
-- The problem this fixes
-- --------------------
-- Migration 0005 installs `deal_events_no_delete`, a BEFORE DELETE trigger that
-- raises for every deletion, including by the service role. That is the right
-- default: deal_events is the audit trail, and a correction should be a new row.
--
-- But POST /api/privacy/erase deletes deal_events as part of a shop erasure, and
-- it could not. The cascade from shops to deal_events fired the same trigger, so
-- deleting a shop that had any recorded event failed too. The route did not check
-- the delete results, so it reported the relational data class as `complete`
-- while nothing had been removed. That is the single most damaging possible bug
-- in this product: an erasure promise that is not kept, reported as kept.
--
-- The fix
-- -------
-- An explicit, transaction-scoped erasure window. `deny_event_mutation` allows
-- DELETE only while the current transaction has opened the window, and the window
-- can only be opened through `begin_erasure_window()`, which:
--
--   * is SECURITY DEFINER, so it cannot be reached by anon or authenticated;
--   * checks that the caller is the service role;
--   * writes to a transaction-local GUC, so it expires automatically at COMMIT
--     or ROLLBACK and cannot leak into a later transaction.
--
-- A routine correction, a stray delete, or a bug in an unrelated route still hits
-- the trigger and is refused. Deletion becomes possible only where erasure is
-- intended, and the intent is visible as one named function call.

-- ---------------------------------------------------------------------------
-- Opens the erasure window for the current transaction only.
-- ---------------------------------------------------------------------------
create or replace function public.begin_erasure_window()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user <> 'service_role' then
    raise exception 'erasure window may only be opened by the service role'
      using errcode = 'insufficient_privilege';
  end if;

  -- third argument true = transaction-local, so this cannot outlive the
  -- transaction even if a pooled connection is reused.
  perform set_config('vendra.erasure_window', 'open', true);
end;
$$;

comment on function public.begin_erasure_window() is
  'Opens a transaction-scoped window in which deal_events may be deleted, for the verified erasure path only. Transaction-local, so it cannot leak into a later transaction. Refuses any role other than service_role.';

revoke all on function public.begin_erasure_window() from public;
grant execute on function public.begin_erasure_window() to service_role;

-- ---------------------------------------------------------------------------
-- Is the window open in this transaction?
-- ---------------------------------------------------------------------------
create or replace function public.erasure_window_open()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('vendra.erasure_window', true), '') = 'open';
$$;

-- ---------------------------------------------------------------------------
-- The guard itself.
--
-- UPDATE stays forbidden unconditionally. Only DELETE becomes reachable, and
-- only inside the window.
-- ---------------------------------------------------------------------------
create or replace function public.deny_event_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and public.erasure_window_open() then
    return old;
  end if;

  raise exception
    'deal_events is append-only; record a correction event instead. Rows may only be deleted inside the verified erasure window opened by begin_erasure_window().'
    using errcode = 'insufficient_privilege';
end;
$$;

comment on function public.deny_event_mutation() is
  'Refuses every change to deal_events, including by the service role. DELETE is permitted only while public.erasure_window_open() is true, which only begin_erasure_window() can set.';

-- ---------------------------------------------------------------------------
-- Verify the shape we just created, rather than trusting it.
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  select pg_get_functiondef(p.oid) into fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'deny_event_mutation';

  if fn is null then
    raise exception 'deny_event_mutation was not replaced';
  end if;

  if fn not like '%erasure_window_open%' then
    raise exception 'deny_event_mutation does not consult the erasure window';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.deal_events'::regclass and tgname = 'deal_events_no_delete'
  ) then
    raise exception 'the deal_events_no_delete trigger is missing';
  end if;
end
$$;
