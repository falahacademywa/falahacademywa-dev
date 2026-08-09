-- ================================================================
-- FALAH ACADEMY PLATFORM — Phase 4b schema
-- Assignments (FR-004), Teacher Workspace role, admission-form
-- intake, forced password change (BR-014).
-- Run AFTER phases 1-3. Re-runnable.
-- ================================================================

-- ---------------- Teacher role ----------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'parent', 'teacher'));

-- Link a login to a teacher record
alter table public.profiles add column if not exists teacher_id uuid references public.teachers;

-- BR-014: force password change on first login
alter table public.profiles add column if not exists must_change_password boolean not null default false;
-- Parents may clear their own flag after changing their password
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.is_teacher_of_grade(gid int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.teacher_grades tg on tg.teacher_id = p.teacher_id
    where p.id = auth.uid() and p.role = 'teacher' and tg.grade_id = gid
  )
$$;

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')
$$;

-- Teachers can see students/enrollments in their assigned grades
drop policy if exists students_teacher_select on public.students;
create policy students_teacher_select on public.students for select
  using (exists (
    select 1 from public.enrollments e
    where e.student_id = id and e.status = 'active' and public.is_teacher_of_grade(e.grade_id)));

drop policy if exists enrollments_teacher_select on public.enrollments;
create policy enrollments_teacher_select on public.enrollments for select
  using (public.is_teacher_of_grade(grade_id));

-- Teachers write Qur'an + academic progress for their grades
drop policy if exists qp_teacher on public.quran_progress;
create policy qp_teacher on public.quran_progress for all
  using (exists (select 1 from public.enrollments e
                 where e.id = enrollment_id and public.is_teacher_of_grade(e.grade_id)))
  with check (exists (select 1 from public.enrollments e
                 where e.id = enrollment_id and public.is_teacher_of_grade(e.grade_id)));

drop policy if exists ap_teacher on public.academic_progress;
create policy ap_teacher on public.academic_progress for all
  using (exists (select 1 from public.enrollments e
                 where e.id = enrollment_id and public.is_teacher_of_grade(e.grade_id)))
  with check (exists (select 1 from public.enrollments e
                 where e.id = enrollment_id and public.is_teacher_of_grade(e.grade_id)));

-- ---------------- Assignments (FR-004) ----------------
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  grade_id int references public.grades,          -- set for grade-wide
  enrollment_id uuid references public.enrollments, -- set for individual
  subject text not null default 'General',
  title text not null,
  instructions text,
  file_url text,                                   -- Google Drive link
  assigned_date date not null default current_date,
  due_date date,
  source text not null default 'manual' check (source in ('manual', 'drive')),
  drive_file_id text unique,                       -- upsert key for Drive sync
  created_by uuid references public.profiles,
  created_at timestamptz not null default now(),
  check (grade_id is not null or enrollment_id is not null)
);

alter table public.assignments enable row level security;

drop policy if exists asg_select on public.assignments;
create policy asg_select on public.assignments for select using (
  public.is_admin()
  or (grade_id is not null and (public.is_teacher_of_grade(grade_id) or public.has_child_in_grade(grade_id)))
  or (enrollment_id is not null and (public.enrollment_is_my_child(enrollment_id)
      or exists (select 1 from public.enrollments e
                 where e.id = enrollment_id and public.is_teacher_of_grade(e.grade_id))))
);

drop policy if exists asg_write on public.assignments;
create policy asg_write on public.assignments for insert with check (
  public.is_admin()
  or (grade_id is not null and public.is_teacher_of_grade(grade_id))
  or (enrollment_id is not null and exists (select 1 from public.enrollments e
      where e.id = enrollment_id and public.is_teacher_of_grade(e.grade_id)))
);

drop policy if exists asg_update on public.assignments;
create policy asg_update on public.assignments for update
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists asg_delete on public.assignments;
create policy asg_delete on public.assignments for delete
  using (public.is_admin() or created_by = auth.uid());

-- BR-038: notify parents when a new assignment is created
create or replace function public.trg_assignment_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.enrollment_id is not null then
    perform public.notify_parents_of_student(
      (select student_id from public.enrollments where id = new.enrollment_id),
      'New assignment: ' || new.title,
      new.subject || coalesce(' — due ' || new.due_date, ''), 'info', '/parent');
  elsif new.grade_id is not null then
    insert into public.notifications (recipient_id, title, message, priority, link_path)
    select distinct ps.parent_id, 'New assignment: ' || new.title,
      new.subject || coalesce(' — due ' || new.due_date, ''), 'info', '/parent'
    from public.parent_students ps
    join public.enrollments e on e.student_id = ps.student_id and e.status = 'active'
    where e.grade_id = new.grade_id;
  end if;
  return new;
end; $$;
drop trigger if exists assignment_notify on public.assignments;
create trigger assignment_notify after insert on public.assignments
  for each row execute function public.trg_assignment_notify();

-- ---------------- Admission form intake (BR-106) ----------------
alter table public.applicants add column if not exists applied_grade_text text;
alter table public.applicants add column if not exists details jsonb;

-- The public website inserts applicants directly (anon key, INSERT only,
-- no read-back). Constrained to fresh under_review records.
drop policy if exists applicants_public_insert on public.applicants;
create policy applicants_public_insert on public.applicants for insert
  to anon
  with check (status = 'under_review' and student_id is null);
