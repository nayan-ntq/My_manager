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
