-- Saraswati School ERP — Phase 1: authentication profiles only.
-- Run in the Supabase SQL Editor for a NEW development project.
-- New users are always 'pending'. A school administrator must assign approved roles.
-- Keep all tables with personal data protected by RLS; extend and test policies per module.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'pending'
    check (role in ('pending', 'admin', 'finance', 'teacher', 'parent', 'student')),
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_saraswati_profile on auth.users;
create trigger on_auth_user_created_saraswati_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.guard_profile_role_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not public.is_admin()
     and (
       new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.id is distinct from old.id
     ) then
    raise exception 'Only a school administrator can change profile role, activation or identity fields.';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists guard_saraswati_profile_role_fields on public.profiles;
create trigger guard_saraswati_profile_role_fields
  before update on public.profiles
  for each row execute function public.guard_profile_role_fields();

drop policy if exists "Profiles visible to owner or admin" on public.profiles;
create policy "Profiles visible to owner or admin"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "Profiles editable by owner or admin" on public.profiles;
create policy "Profiles editable by owner or admin"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;

-- Create the first staff Auth user in the Supabase dashboard, then promote only
-- that verified account via the SQL Editor:
-- update public.profiles
-- set role = 'admin', is_active = true
-- where id = 'REPLACE-WITH-THE-AUTH-USER-UUID';
--
-- Demo roles (including finance) are simulated in browser-only demo mode.
-- This file is only the Phase 1 profile/RLS foundation, not the full ERP schema.
