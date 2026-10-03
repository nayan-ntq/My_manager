-- Full current schema for My Manager - regenerated directly from the live
-- database, so this is guaranteed accurate as of this export. Safe to run on
-- a fresh Supabase project (tables/extension use "if not exists"; policies
-- are dropped and recreated).

create extension if not exists pgcrypto;

-- ================= personal side =================
create table if not exists public.task_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  label text not null,
  color text not null default '#5B7FDB',
  icon_key text not null default 'briefcase',
  position int not null default 0,
  unique (user_id, key)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null,
  date date not null,
  time time not null,
  duration_min int not null default 15,
  anchored boolean not null default false,
  important boolean not null default false,
  status text not null default 'pending' check (status in ('pending','done','skipped')),
  actual_start timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_date_idx on public.tasks (user_id, date);

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position int not null default 0
);
create index if not exists subtasks_task_idx on public.subtasks (task_id);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  photos jsonb not null default '[]'::jsonb,
  position int not null default 0
);
create index if not exists exercises_task_idx on public.exercises (task_id);

create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number int not null default 1,
  reps int,
  weight numeric,
  weight_unit text not null default 'kg',
  done boolean not null default false
);
create index if not exists exercise_sets_exercise_idx on public.exercise_sets (exercise_id);

create table if not exists public.user_meta (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  points int not null default 0,
  streak int not null default 0,
  longest_streak int not null default 0,
  last_active_day date,
  badges_earned jsonb not null default '[]'::jsonb
);

-- ================= teacher side =================
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position int not null default 0,
  roll_no text,
  contact text,
  notes text
);
create index if not exists students_class_idx on public.students (class_id);

create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time,
  label text,
  position int not null default 0
);

create table if not exists public.planner_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  date date not null,
  chapter_number text,
  chapter text,
  objectives text,
  methodology text,
  resources text,
  assignment text,
  reflection text,
  concepts jsonb not null default '[]'::jsonb,
  exercise_list jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists planner_class_date_idx on public.planner_entries (class_id, date);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  date date not null,
  present jsonb not null default '{}'::jsonb,
  is_day_off boolean not null default false,
  unique (class_id, date)
);

create table if not exists public.correction_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  date date not null,
  title text not null,
  type text not null,
  chapter_number text,
  concepts jsonb not null default '[]'::jsonb,
  exercise_list jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  marks jsonb not null default '{}'::jsonb,
  concept_marks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Full audit trail of every status change on a correction record, per student
-- and optionally per concept (concept = null means the overall record-level
-- status). Never overwritten - each change is a new row, so punctuality/delay
-- patterns can be reconstructed later.
create table if not exists public.correction_status_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid not null references public.correction_records(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  concept text,
  status text not null,
  remark text,
  next_date date,
  marked_at timestamptz not null default now()
);
create index if not exists correction_log_lookup_idx on public.correction_status_log (record_id, student_id, concept);

create table if not exists public.performance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  test_type text not null,
  max_marks numeric not null default 20,
  passing_marks numeric,
  chapter_number text,
  chapter_count int,
  exercises text,
  concepts jsonb not null default '[]'::jsonb,
  concept_marks jsonb not null default '{}'::jsonb,
  marks jsonb not null default '{}'::jsonb,
  absent jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.import_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, -- 'planner' | 'roster' | 'correction' | 'performance' | 'workout' | 'timetable'
  source_note text,
  csv_preview text,
  row_count int,
  status text not null default 'pending', -- 'pending' | 'imported' | 'discarded'
  created_at timestamptz not null default now()
);

-- ================= row level security =================
alter table public.task_categories enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.user_meta enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.planner_entries enable row level security;
alter table public.attendance_records enable row level security;
alter table public.correction_records enable row level security;
alter table public.correction_status_log enable row level security;
alter table public.performance_records enable row level security;
alter table public.import_logs enable row level security;

drop policy if exists "task_categories_owner" on public.task_categories;
create policy "task_categories_owner" on public.task_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "tasks_owner" on public.tasks;
create policy "tasks_owner" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "subtasks_owner" on public.subtasks;
create policy "subtasks_owner" on public.subtasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "exercises_owner" on public.exercises;
create policy "exercises_owner" on public.exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "exercise_sets_owner" on public.exercise_sets;
create policy "exercise_sets_owner" on public.exercise_sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_meta_owner" on public.user_meta;
create policy "user_meta_owner" on public.user_meta for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "classes_owner" on public.classes;
create policy "classes_owner" on public.classes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "students_owner" on public.students;
create policy "students_owner" on public.students for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "timetable_owner" on public.timetable_slots;
create policy "timetable_owner" on public.timetable_slots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "planner_owner" on public.planner_entries;
create policy "planner_owner" on public.planner_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "attendance_owner" on public.attendance_records;
create policy "attendance_owner" on public.attendance_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "correction_owner" on public.correction_records;
create policy "correction_owner" on public.correction_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "correction_status_log_owner" on public.correction_status_log;
create policy "correction_status_log_owner" on public.correction_status_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "performance_owner" on public.performance_records;
create policy "performance_owner" on public.performance_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "import_logs_owner" on public.import_logs;
create policy "import_logs_owner" on public.import_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ================= teacher mode: school scoping =================
-- Applied live via Supabase migration "teacher_mode_school_scoping".
-- Every teacher belongs to a school (schools + school_members); classes
-- carry a school_id, set automatically on insert via a trigger. Roles
-- school_admin/super_admin are reserved for the admin modes, not yet built.
-- NOTE: the personal-side tables above (tasks, subtasks, exercises,
-- exercise_sets, task_categories, user_meta) still exist in the live
-- database with real historical data, but the app no longer reads or
-- writes them as of the teacher-mode + home-page update. Not dropped
-- pending explicit confirmation.

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

drop policy if exists "school_members_insert_self_teacher" on public.school_members;
create policy "school_members_insert_self_teacher" on public.school_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'teacher'
    and exists (select 1 from public.schools s where s.id = school_members.school_id and s.created_by = (select auth.uid()))
  );

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
-- School admin mode: freeform hierarchy (divisions), invite-code onboarding,
-- and department-wise coordinator planner sign-off. Additive only.
-- ALREADY APPLIED to the live project (migration name: school_admin_mode,
-- plus one follow-up revoke on guard_planner_reviewer_update's EXECUTE grant).

-- ---------- freeform hierarchy ----------
create table if not exists public.divisions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_id uuid references public.divisions(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists divisions_school_idx on public.divisions (school_id);
create index if not exists divisions_parent_idx on public.divisions (parent_id);

alter table public.classes add column if not exists division_id uuid references public.divisions(id) on delete set null;
create index if not exists classes_division_idx on public.classes (division_id);

alter table public.school_members add column if not exists division_id uuid references public.divisions(id) on delete set null;

alter table public.school_members drop constraint if exists school_members_role_check;
alter table public.school_members add constraint school_members_role_check
  check (role in ('teacher','coordinator','school_admin','super_admin'));

alter table public.divisions enable row level security;

drop policy if exists "divisions_select_member" on public.divisions;
create policy "divisions_select_member" on public.divisions for select to authenticated
  using (exists (select 1 from public.school_members m where m.school_id = divisions.school_id and m.user_id = (select auth.uid())));

drop policy if exists "divisions_admin_write" on public.divisions;
create policy "divisions_admin_write" on public.divisions for all to authenticated
  using (exists (select 1 from public.school_members m where m.school_id = divisions.school_id and m.user_id = (select auth.uid()) and m.role in ('school_admin','super_admin')))
  with check (exists (select 1 from public.school_members m where m.school_id = divisions.school_id and m.user_id = (select auth.uid()) and m.role in ('school_admin','super_admin')));

drop policy if exists "school_members_select_school_admin" on public.school_members;
create policy "school_members_select_school_admin" on public.school_members for select to authenticated
  using (exists (select 1 from public.school_members m2 where m2.school_id = school_members.school_id and m2.user_id = (select auth.uid()) and m2.role in ('school_admin','super_admin')));

drop policy if exists "school_members_admin_manage" on public.school_members;
create policy "school_members_admin_manage" on public.school_members for update to authenticated
  using (exists (select 1 from public.school_members m2 where m2.school_id = school_members.school_id and m2.user_id = (select auth.uid()) and m2.role in ('school_admin','super_admin')))
  with check (exists (select 1 from public.school_members m2 where m2.school_id = school_members.school_id and m2.user_id = (select auth.uid()) and m2.role in ('school_admin','super_admin')));
drop policy if exists "school_members_admin_remove" on public.school_members;
create policy "school_members_admin_remove" on public.school_members for delete to authenticated
  using (exists (select 1 from public.school_members m2 where m2.school_id = school_members.school_id and m2.user_id = (select auth.uid()) and m2.role in ('school_admin','super_admin')));

-- ---------- invite codes (no email service needed: admin shares a short code) ----------
create table if not exists public.school_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code text not null unique,
  role text not null default 'teacher' check (role in ('teacher','coordinator','school_admin')),
  division_id uuid references public.divisions(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  max_uses int not null default 1,
  uses int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists school_invites_school_idx on public.school_invites (school_id);

alter table public.school_invites enable row level security;

drop policy if exists "school_invites_admin_all" on public.school_invites;
create policy "school_invites_admin_all" on public.school_invites for all to authenticated
  using (exists (select 1 from public.school_members m where m.school_id = school_invites.school_id and m.user_id = (select auth.uid()) and m.role in ('school_admin','super_admin')))
  with check (exists (select 1 from public.school_members m where m.school_id = school_invites.school_id and m.user_id = (select auth.uid()) and m.role in ('school_admin','super_admin')));

create or replace function public.redeem_school_invite(invite_code text)
returns table (school_id uuid, school_name text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  select * into inv from public.school_invites where code = invite_code for update;
  if inv is null then
    raise exception 'Invite code not found';
  end if;
  if inv.uses >= inv.max_uses then
    raise exception 'This invite code has already been used';
  end if;
  if exists (select 1 from public.school_members sm where sm.school_id = inv.school_id and sm.user_id = uid) then
    raise exception 'You are already a member of this school';
  end if;

  insert into public.school_members (school_id, user_id, role, division_id)
  values (inv.school_id, uid, inv.role, inv.division_id);

  update public.school_invites set uses = uses + 1 where id = inv.id;

  update public.classes set school_id = inv.school_id where user_id = uid and school_id is null;

  return query select s.id, s.name, inv.role from public.schools s where s.id = inv.school_id;
end;
$$;
revoke all on function public.redeem_school_invite(text) from public, anon;
grant execute on function public.redeem_school_invite(text) to authenticated;

-- ---------- planner sign-off ----------
alter table public.planner_entries add column if not exists signoff_status text not null default 'none' check (signoff_status in ('none','pending','approved','rejected'));
alter table public.planner_entries add column if not exists signoff_by uuid references auth.users(id) on delete set null;
alter table public.planner_entries add column if not exists signoff_at timestamptz;
alter table public.planner_entries add column if not exists signoff_note text;

drop policy if exists "planner_reviewer_select" on public.planner_entries;
create policy "planner_reviewer_select" on public.planner_entries for select to authenticated
  using (
    exists (
      select 1 from public.classes c
      join public.school_members m on m.school_id = c.school_id and m.user_id = (select auth.uid())
      where c.id = planner_entries.class_id
        and m.role in ('school_admin','super_admin','coordinator')
        and (m.role in ('school_admin','super_admin') or m.division_id is null or m.division_id = c.division_id)
    )
  );

drop policy if exists "planner_reviewer_update" on public.planner_entries;
create policy "planner_reviewer_update" on public.planner_entries for update to authenticated
  using (
    exists (
      select 1 from public.classes c
      join public.school_members m on m.school_id = c.school_id and m.user_id = (select auth.uid())
      where c.id = planner_entries.class_id
        and m.role in ('school_admin','super_admin','coordinator')
        and (m.role in ('school_admin','super_admin') or m.division_id is null or m.division_id = c.division_id)
    )
  )
  with check (true);

create or replace function public.guard_planner_reviewer_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id = old.user_id and new.user_id = auth.uid() then
    return new;
  end if;
  if new.class_id is distinct from old.class_id or new.date is distinct from old.date
     or new.chapter_number is distinct from old.chapter_number or new.chapter is distinct from old.chapter
     or new.objectives is distinct from old.objectives or new.methodology is distinct from old.methodology
     or new.resources is distinct from old.resources or new.assignment is distinct from old.assignment
     or new.reflection is distinct from old.reflection or new.concepts is distinct from old.concepts
     or new.exercise_list is distinct from old.exercise_list or new.photos is distinct from old.photos
     or new.user_id is distinct from old.user_id then
    raise exception 'Reviewers may only change sign-off status';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_planner_reviewer_update() from public, anon, authenticated;
drop trigger if exists planner_guard_reviewer_update on public.planner_entries;
create trigger planner_guard_reviewer_update before update on public.planner_entries
  for each row execute function public.guard_planner_reviewer_update();

-- ---------- profiles (for the admin roster: Supabase doesn't expose auth.users to the client) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email;

alter table public.profiles enable row level security;

drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self" on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles_school_member" on public.profiles;
create policy "profiles_school_member" on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.school_members m1
      join public.school_members m2 on m2.school_id = m1.school_id
      where m1.user_id = (select auth.uid()) and m2.user_id = profiles.id
    )
  );
