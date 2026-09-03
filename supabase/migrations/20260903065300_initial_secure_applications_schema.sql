-- AFC membership applications contain identity and medical documents.
-- The public client has no direct write access: submissions must go through
-- a server-side endpoint/Edge Function that validates uploads and uses a
-- service-role client. Only approved administrators can inspect records.

begin;

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.application_status as enum (
  'to_review',
  'complete',
  'incomplete'
);

create type public.document_kind as enum (
  'identity_card',
  'medical_certificate'
);

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(btrim(display_name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(btrim(first_name)) between 1 and 120),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 120),
  email text not null check (
    char_length(email) <= 320
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  phone text not null check (char_length(btrim(phone)) between 7 and 32),
  address text not null check (char_length(btrim(address)) between 1 and 500),
  consent_accepted_at timestamptz not null,
  status public.application_status not null default 'to_review',
  reviewed_by uuid references public.admin_users (user_id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_review_metadata_check check (
    (status = 'to_review' and reviewed_by is null and reviewed_at is null)
    or (status in ('complete', 'incomplete') and reviewed_by is not null and reviewed_at is not null)
  )
);

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  kind public.document_kind not null,
  storage_path text not null unique check (storage_path like application_id::text || '/%'),
  original_name text not null check (char_length(btrim(original_name)) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now(),
  unique (application_id, kind)
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger applications_set_updated_at
before update on public.applications
for each row
execute function private.set_updated_at();

create or replace function private.set_application_review_metadata()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.status = 'to_review' then
    new.reviewed_by := null;
    new.reviewed_at := null;
  elsif old.status is distinct from new.status
    or new.reviewed_by is null
    or new.reviewed_at is null then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;

create trigger applications_set_review_metadata
before update on public.applications
for each row
execute function private.set_application_review_metadata();

-- This helper is intentionally in a non-exposed schema. It allows RLS
-- policies to test the administrator allow-list without recursive policies.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.set_application_review_metadata() from public;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.applications enable row level security;
alter table public.application_documents enable row level security;

revoke all on table public.admin_users, public.applications, public.application_documents from anon;
revoke all on table public.admin_users, public.applications, public.application_documents from authenticated;

grant select on table public.admin_users to authenticated;
grant select, update (status) on table public.applications to authenticated;
grant select on table public.application_documents to authenticated;

create policy "Administrators can view administrator profiles"
on public.admin_users
for select
to authenticated
using ((select private.is_admin()));

create policy "Administrators can view applications"
on public.applications
for select
to authenticated
using ((select private.is_admin()));

create policy "Administrators can update applications"
on public.applications
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Administrators can view application document metadata"
on public.application_documents
for select
to authenticated
using ((select private.is_admin()));

-- The bucket remains private. No direct storage.objects policy is created:
-- uploads and signed download URLs must be produced by trusted server code.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'application-documents',
  'application-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']::text[]
);

comment on table public.admin_users is
  'Allow-list of Supabase Auth users permitted to review membership applications.';
comment on table public.applications is
  'Membership application metadata. Identity and medical files stay in the private Storage bucket.';
comment on table public.application_documents is
  'Metadata for the two required private Storage objects per membership application.';

commit;
