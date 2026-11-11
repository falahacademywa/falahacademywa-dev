-- DEV ONLY (President 2026-11-10): the dev project never e-mails anyone.
-- email_now() (phase 41) checks this row and sends nothing. NEVER run this in prod
-- (it would stop every e-mail the database sends there). Re-runnable.
insert into public.app_settings (key, value) values ('email_mode', 'off')
on conflict (key) do update set value = 'off';
select key, value from public.app_settings where key = 'email_mode';
