begin;

-- The bucket stays private. Only authenticated users listed in admin_users
-- may request a short-lived signed URL or download an object.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Administrators can read application documents'
  ) then
    create policy "Administrators can read application documents"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'application-documents'
      and (select private.is_admin())
    );
  end if;
end;
$$;

commit;
