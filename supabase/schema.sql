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
