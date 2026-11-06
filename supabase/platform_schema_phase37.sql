-- Phase 37 (2026-11-05, President): follow-ups to teacher requests (phase 35) and Red Comet pages.
--
--   * Closed requests are read-only: once a request is Resolved (done) or Declined, nobody can add
--     a note (and, as before, the teacher cannot edit or delete it). The President or an admin can
--     Reopen it first if something needs saying.
--   * Request notifications show the latest only: a new notification about a request replaces the
--     older ones for the same person and the same request (one per request in the bell and on the
--     teacher app's Today screen). Existing duplicates are cleared once below.
--   * Red Comet: teachers enter the last workbook page in the photos they send, per subject. The
--     teacher app shows "Last page uploaded: N" for each subject of the chosen student
--     (work_uploads.page_last, the most recent upload that has one).
--
-- Safe to run more than once.

-- ---------- Red Comet: last page per upload ----------
alter table public.work_uploads add column if not exists page_last integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'work_uploads_page_last_chk') then
    alter table public.work_uploads add constraint work_uploads_page_last_chk check (page_last is null or page_last between 1 and 9999);
  end if;
end $$;
create index if not exists work_uploads_last_page_idx on public.work_uploads (enrollment_id, subject, created_at desc) where page_last is not null;

-- ---------- closed requests take no more notes ----------
create or replace function public.teacher_request_add_note(p_id bigint, p_body text, p_internal boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare r public.teacher_requests; admin boolean := public.can_edit('teacher_requests');
begin
  select * into r from public.teacher_requests where id = p_id;
  if not found or not public.tr_visible(r) then raise exception 'request not found'; end if;
  if not admin and not public.is_teacher() then raise exception 'not allowed'; end if;
  if r.status in ('done', 'declined') then raise exception 'this request is closed; reopen it to add a note'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'empty note'; end if;
  insert into public.teacher_request_notes (request_id, author_id, kind, internal, body)
  values (p_id, auth.uid(), 'note', admin and coalesce(p_internal, false), trim(p_body));
  update public.teacher_requests set updated_at = now() where id = p_id;
  if admin and not coalesce(p_internal, false) then
    perform public.tr_notify(r.created_by, 'Note on your request R' || p_id, trim(p_body), '/teacher/requests?r=' || p_id);
  elsif not admin then
    insert into public.notifications (recipient_id, title, message, priority, link_path)
    select a.id, 'Teacher note on R' || p_id, left(trim(p_body), 240), 'info', '/admin/teacher-requests?r=' || p_id
      from public.profiles a where a.role = 'admin' and a.id <> auth.uid();
  end if;
end; $$;
grant execute on function public.teacher_request_add_note(bigint, text, boolean) to authenticated;

-- ---------- request notifications: latest only ----------
create or replace function public.notifications_request_latest_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications
   where recipient_id = new.recipient_id and link_path = new.link_path and id <> new.id;
  return null;
end; $$;
drop trigger if exists notifications_request_latest_only on public.notifications;
create trigger notifications_request_latest_only after insert on public.notifications
  for each row when (new.link_path ~ '^/(teacher/requests|admin/teacher-requests)\?r=[0-9]+$')
  execute function public.notifications_request_latest_only();

-- one-off: keep only the newest request notification per person and request
delete from public.notifications n
 where n.link_path ~ '^/(teacher/requests|admin/teacher-requests)\?r=[0-9]+$'
   and exists (select 1 from public.notifications m
                where m.recipient_id = n.recipient_id and m.link_path = n.link_path
                  and (m.created_at, m.id) > (n.created_at, n.id));

select 'phase 37 ok' as result,
  (select count(*) from information_schema.columns where table_name = 'work_uploads' and column_name = 'page_last') as page_col,
  (select count(*) from pg_trigger where tgname = 'notifications_request_latest_only') as trigger_ok;
