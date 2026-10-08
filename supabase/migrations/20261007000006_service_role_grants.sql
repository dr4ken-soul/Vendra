-- Vendra 0006: explicit grants for the server-side service role.
--
-- The Supabase project was created with "Automatically expose new tables"
-- disabled, which is the correct security posture: new tables receive no blanket
-- grants to anon or authenticated.
--
-- The side effect is that the `service_role` role also receives no default
-- grants, so the server-side admin client that Vendra depends on (memory-scope
-- provisioning, signed evidence URLs, team invitations) fails with
-- "permission denied for table ...".
--
-- This migration grants the service role explicitly and keeps it able to work
-- with objects created later. `service_role` bypasses Row Level Security, so
-- every call site using this role must already have derived and checked the
-- tenant scope itself. It is never used from a client component.
--
-- The anon role is deliberately left with nothing.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
grant usage on schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- storage.objects is reached directly by the server for signed URLs and
-- removal, outside the evidence storage policies that govern users.
grant all on all tables in schema storage to service_role;

comment on role service_role is
  'Vendra server-side only. Bypasses RLS, so every call site must derive tenant scope from the authenticated session first.';