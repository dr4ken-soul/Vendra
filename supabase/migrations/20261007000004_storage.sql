-- Vendra 0004: private evidence storage.
-- Evidence files are never represented by a permanent public URL.
-- Reference: PRIVACY_SECURITY.md section 6, DATA_API_CONTRACTS.md section 4.

-- A single private bucket. `public` stays false so no object can be fetched
-- without a short-lived signed URL issued after a membership check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  false,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Object paths are shop-scoped: <shop_id>/<deal_id>/<uuid>.<ext>
-- Policies check real membership and the evidence_files association rather
-- than trusting the path text alone.
-- ---------------------------------------------------------------------------

create or replace function public.storage_path_shop_id(name text)
returns uuid
language plpgsql
immutable
as $$
declare
  first_segment text;
begin
  first_segment := split_part(name, '/', 1);
  return first_segment::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.storage_path_deal_id(name text)
returns uuid
language plpgsql
immutable
as $$
declare
  second_segment text;
begin
  second_segment := split_part(name, '/', 2);
  return second_segment::uuid;
exception when others then
  return null;
end;
$$;

create policy evidence_upload_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and public.storage_path_shop_id(name) is not null
    and public.has_shop_permission(
      public.storage_path_shop_id(name),
      'evidence.upload'
    )
    and (
      public.storage_path_deal_id(name) is null
      or exists (
        select 1 from public.deals d
        where d.id = public.storage_path_deal_id(name)
          and d.shop_id = public.storage_path_shop_id(name)
      )
    )
  );

-- Read of an object is allowed when the caller can view evidence in the shop
-- that owns the path. Signed URLs are still issued only after a separate
-- server-side check that the object is associated with a visible evidence row.
create policy evidence_object_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidence'
    and public.has_shop_permission(
      public.storage_path_shop_id(name),
      'evidence.view'
    )
  );

create policy evidence_object_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'evidence'
    and public.has_shop_permission(
      public.storage_path_shop_id(name),
      'evidence.upload'
    )
  );

-- No update policy: evidence objects are immutable once uploaded. A correction
-- is recorded as a new evidence row and a new deal event.

revoke all on function public.storage_path_shop_id(text) from public;
revoke all on function public.storage_path_deal_id(text) from public;
grant execute on function public.storage_path_shop_id(text) to authenticated;
grant execute on function public.storage_path_deal_id(text) to authenticated;