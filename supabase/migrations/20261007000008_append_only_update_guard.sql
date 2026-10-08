-- Vendra 0008: fix the inverted condition on the deal_events UPDATE guard.
--
-- The problem
-- -----------
-- Migration 0005 declared:
--
--   create trigger deal_events_no_update
--     before update on public.deal_events
--     for each row when (old.superseded_at is null and old.summary = new.summary)
--     execute function public.deny_event_mutation();
--
-- The WHEN clause reads as though it were protecting the summary, but it does the
-- opposite. `old.summary = new.summary` is true when the summary is UNCHANGED, so
-- the trigger fired only for updates that left the summary alone, and stayed
-- silent for the rewrite it was written to prevent. The service role could
-- therefore silently overwrite a recorded event's text, which is exactly the
-- "hallucinated supplier fact" risk PRIVACY_SECURITY.md section 6 is about, and
-- exactly what an append-only audit trail must not permit.
--
-- Meanwhile `superseded_at` was the field that actually needed to be writable,
-- and updates that only touched it were blocked.
--
-- The fix
-- -------
-- Fire when the summary changes. Superseding a row is the supported correction
-- mechanism and stays permitted, because a correction is recorded as a new event
-- and the old one is marked superseded rather than rewritten.

drop trigger if exists deal_events_no_update on public.deal_events;

create trigger deal_events_no_update
  before update on public.deal_events
  for each row
  when (old.superseded_at is null and old.summary is distinct from new.summary)
  execute function public.deny_event_mutation();

comment on trigger deal_events_no_update on public.deal_events is
  'Refuses rewriting the text of a recorded event, including by the service role. Setting superseded_at is permitted: that is the append-only correction path.';

-- ---------------------------------------------------------------------------
-- Verify the guard is present and reads the way it is meant to.
-- ---------------------------------------------------------------------------
do $$
declare
  enabled boolean;
begin
  select t.tgenabled <> 'D' into enabled
  from pg_trigger t
  where t.tgrelid = 'public.deal_events'::regclass and t.tgname = 'deal_events_no_update';

  if enabled is null or not enabled then
    raise exception 'deal_events_no_update is missing or disabled';
  end if;

  -- Guard against the condition regressing back to the inverted form.
  if (select pg_get_triggerdef(t.oid) from pg_trigger t
      where t.tgrelid = 'public.deal_events'::regclass
        and t.tgname = 'deal_events_no_update') not like '%IS DISTINCT FROM%' then
    raise exception 'deal_events_no_update no longer guards on a changed summary';
  end if;
end
$$;
