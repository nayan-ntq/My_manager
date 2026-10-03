-- Teacher mode: every teacher belongs to a school; classes are scoped to it.
-- Additive only. Personal tables (tasks, etc.) are left untouched.
-- ALREADY APPLIED to the live project (migration name: teacher_mode_school_scoping).
-- Append this block to supabase/schema.sql to keep that snapshot accurate.

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'teacher' check (role in ('teacher','school_admin','super_admin')),
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);
create index if not exists school_members_user_idx on public.school_members (user_id);
create index if not exists schools_created_by_idx on public.schools (created_by);

alter table public.classes add column if not exists school_id uuid references public.schools(id) on delete set null;
create index if not exists classes_school_idx on public.classes (school_id);

alter table public.schools enable row level security;
alter table public.school_members enable row level security;

drop policy if exists "schools_select_member_or_creator" on public.schools;
create policy "schools_select_member_or_creator" on public.schools for select to authenticated
  using (
    created_by = (select auth.uid())
    or exists (select 1 from public.school_members m where m.school_id = schools.id and m.user_id = (select auth.uid()))
  );

drop policy if exists "schools_insert_own" on public.schools;
create policy "schools_insert_own" on public.schools for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "school_members_select_own" on public.school_members;
create policy "school_members_select_own" on public.school_members for select to authenticated
  using (user_id = (select auth.uid()));

-- A user may only enrol themselves as a teacher in a school they created.
-- Joining someone else's school, and admin roles, will come with admin mode (invites).
drop policy if exists "school_members_insert_self_teacher" on public.school_members;
create policy "school_members_insert_self_teacher" on public.school_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'teacher'
    and exists (select 1 from public.schools s where s.id = school_members.school_id and s.created_by = (select auth.uid()))
  );

-- New classes automatically inherit the creating teacher's school.
create or replace function public.set_class_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.school_id is null then
    select sm.school_id into new.school_id
    from public.school_members sm
    where sm.user_id = new.user_id
    order by sm.created_at
    limit 1;
  end if;
  return new;
end;
$$;
revoke execute on function public.set_class_school() from public, anon, authenticated;

drop trigger if exists classes_set_school on public.classes;
create trigger classes_set_school before insert on public.classes
  for each row execute function public.set_class_school();
