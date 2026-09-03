alter table public.applications
  alter column email drop not null,
  alter column phone drop not null,
  alter column address drop not null;
