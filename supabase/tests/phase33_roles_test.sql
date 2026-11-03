-- DEV ONLY: phase 33 as a teacher, a parent and a plain teacher of another grade.
-- Makes a throw-away event dated yesterday, runs the checks, removes it again.
drop table if exists ptm_t; create temp table ptm_t (n serial, k text, v jsonb);
grant all on ptm_t to authenticated; grant usage on sequence ptm_t_n_seq to authenticated;

do $$
declare ev int; c int; pre int; kid uuid; fam int;
begin
  select id into pre from public.grades where name = 'Pre-K';
  insert into public.ptm_events (title, meet_date, slots) values ('TEST past', current_date - 1, array['09:30']::time[]) returning id into ev;
  insert into public.ptm_classes (event_id, name, grade_ids) values (ev, 'TEST Pre-K', array[pre]) returning id into c;
  insert into public.ptm_links (class_id) values (c);
  perform public.ptm_fill_class(c);
  select student_id, family_no into kid, fam from public.ptm_students where class_id = c
   and student_id in (select student_id from public.parent_students) limit 1;
  insert into public.ptm_bookings (class_id, family_no, slot, parent_name) values (c, fam, '09:30', 'Test');
  insert into ptm_t (k, v) values ('setup', jsonb_build_object('class', c, 'kid', kid));
end $$;

-- a Pre-K class teacher
select set_config('t.uid', (select t.user_id::text from public.teachers t join public.teacher_grades tg on tg.teacher_id = t.id
   join public.grades g on g.id = tg.grade_id where g.name = 'Pre-K' and tg.role <> 'quran' and t.app_access and t.active and t.user_id is not null limit 1), false);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.uid'), 'role', 'authenticated')::text, false);
set role authenticated;
insert into ptm_t (k, v) select 'teacher uid set', to_jsonb(auth.uid() is not null);
insert into ptm_t (k, v) select 'teacher view classes', (select jsonb_agg(x->>'class') from jsonb_array_elements(public.ptm_teacher_view()) x);
insert into ptm_t (k, v) select 'remark past (should be ok)', public.ptm_save_remark((select (v->>'class')::int from ptm_t where k = 'setup'), (select (v->>'kid')::uuid from ptm_t where k = 'setup'), 'class', 'Doing well; practise letters at home.');
insert into ptm_t (k, v) select 'remark as quran (should fail)', public.ptm_save_remark((select (v->>'class')::int from ptm_t where k = 'setup'), (select (v->>'kid')::uuid from ptm_t where k = 'setup'), 'quran', 'x');
insert into ptm_t (k, v) select 'remark Nov 18 (should fail: not over)', public.ptm_save_remark((select id from public.ptm_classes where name = 'Pre-K' and event_id = (select id from public.ptm_events where meet_date = '2026-11-18')),
   (select student_id from public.ptm_students where class_id = (select id from public.ptm_classes where name = 'Pre-K' and event_id = (select id from public.ptm_events where meet_date = '2026-11-18')) and invited limit 1), 'class', 'x');
insert into ptm_t (k, v) select 'teacher reads tables (0 expected)', to_jsonb((select count(*) from public.ptm_bookings) + (select count(*) from public.ptm_links));
insert into ptm_t (k, v) select 'teacher admin view', to_jsonb('blocked'::text) where false;
reset role;

-- that child's parent
select set_config('t.uid', (select ps.parent_id::text from public.parent_students ps where ps.student_id = (select (v->>'kid')::uuid from ptm_t where k = 'setup') limit 1), false);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.uid'), 'role', 'authenticated')::text, false);
set role authenticated;
insert into ptm_t (k, v) select 'parent view', public.ptm_parent_view();
insert into ptm_t (k, v) select 'parent remark (should fail)', public.ptm_save_remark((select (v->>'class')::int from ptm_t where k = 'setup'), (select (v->>'kid')::uuid from ptm_t where k = 'setup'), 'class', 'x');
reset role;
select set_config('request.jwt.claims', '', false);

-- clean up: the test event and the notification it sent
delete from public.notifications where title = 'Parent-teacher meeting notes' and created_at > now() - interval '10 minutes';
delete from public.ptm_events where title = 'TEST past';
select k, left(v::text, 400) from ptm_t order by n;
