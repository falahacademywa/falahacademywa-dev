# Platform Operations Guide

Zero-cost operations for the Falah Academy Operations Platform.

## 1. Keep-alive (prevents free-tier pausing)

Workflow: `.github/workflows/platform-keepalive.yml` (runs Mon+Thu).
One-time setup — add repo secrets (GitHub repo → Settings → Secrets and
variables → Actions → New repository secret):

- `PLATFORM_SUPABASE_URL` = `https://rlaqpzeqmmlrdeqfbjyq.supabase.co`
- `PLATFORM_SUPABASE_ANON_KEY` = the publishable key

## 2. Weekly encrypted backups (free tier has NO automatic backups)

Backups must live in a **private** repo (public-repo artifacts are publicly
downloadable). One-time setup (~10 min):

1. Create a free **private** repo under the falahacademywa account, e.g. `falah-backups`.
2. In that repo add secrets:
   - `SUPABASE_DB_URL` — Supabase Dashboard → Project Settings → Database →
     Connection string (URI). Includes the database password.
   - `BACKUP_PASSPHRASE` — any long random passphrase; store a copy in the
     school's password store. Needed to decrypt backups.
3. Add this workflow as `.github/workflows/backup.yml` in the private repo:

```yaml
name: Weekly encrypted DB backup
on:
  schedule:
    - cron: "0 10 * * 0"   # Sundays ~2-3am Pacific
  workflow_dispatch: {}
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Dump and encrypt
        run: |
          sudo apt-get -qq install -y postgresql-client
          pg_dump "${{ secrets.SUPABASE_DB_URL }}" --no-owner --no-privileges \
            | gzip \
            | openssl enc -aes-256-cbc -pbkdf2 -salt \
                -pass "pass:${{ secrets.BACKUP_PASSPHRASE }}" \
                -out "backup-$(date +%F).sql.gz.enc"
      - name: Commit backup (keep last 8)
        run: |
          git config user.name "backup-bot"
          git config user.email "backup@falahacademywa.org"
          git add backup-*.sql.gz.enc
          ls -t backup-*.sql.gz.enc | tail -n +9 | xargs -r git rm -f --ignore-unmatch
          git commit -m "Backup $(date +%F)" || echo "nothing to commit"
          git push
```

To restore: `openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:PASSPHRASE -in backup-DATE.sql.gz.enc | gunzip | psql NEW_DB_URL`

## 3. Attendance sheet (teachers' Google Sheet → platform)

1. In the school's Google account create a spreadsheet "Falah Academy Attendance 2026-2027".
2. One tab per grade, named exactly: `Pre-K`, `KG`, `Grade 1`, `Grade 3`.
3. Each tab layout (row 1 headers, then one row per student):
   | StudentNo | Student Name | 2026-08-26 | 2026-08-27 | ... |
   |-----------|--------------|------------|------------|-----|
   | 10001     | Ahmed T.     | P          | L          |     |
   Values: `P` present · `L` late · `A` absent · blank = not recorded.
   Student numbers come from the platform's Students page.
4. Extensions → Apps Script → paste `google-apps-script/attendance-sync.gs`.
5. Project Settings → Script properties:
   - `SUPABASE_URL` = the project URL
   - `SUPABASE_SERVICE_KEY` = the **secret** key (Dashboard → API keys).
     The secret key is safe HERE because Apps Script runs privately inside
     the school's Google account — never put it in the website.
6. Triggers → Add trigger → `syncAttendance` → From spreadsheet → On change.
   Optionally add a time-driven hourly trigger as a safety net.

## 4. Daily notifications + email (Phase 4)

Workflow: `.github/workflows/platform-notifications.yml` (daily ~8:30am Pacific).
It runs the fee-reminder rule and emails parents any unread portal notifications.
Setup:

1. Repo secret `PLATFORM_SUPABASE_SERVICE_KEY` = the **secret** key
   (Dashboard → API Keys). GitHub secrets are encrypted — safe there,
   never in code.
2. Free Brevo account (brevo.com, 300 emails/day) with the school email →
   SMTP & API → generate an API key → repo secret `BREVO_API_KEY`.
3. Optional deliverability: in Brevo, add falahacademywa.org as a verified
   sender domain (they give you DNS records to add in Cloudflare) so emails
   send from the school domain rather than Gmail.
Emails to `*.test.local` addresses are skipped automatically.

## 5. Assignments Drive folder (teachers upload once, portal shows it)

1. In the school's Drive create a folder **Falah Assignments** with one
   subfolder per grade, named exactly like the platform grades:
   `Pre-K`, `KG`, `Grade 1`, `Grade 3`.
2. Teachers drop files named: `2026-09-05 - Math - Worksheet p12.pdf`
   (due date - subject - title). No date = no due date shown.
3. script.google.com -> New project -> paste
   `google-apps-script/drive-assignments-sync.gs`.
4. Script properties: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
   `ASSIGNMENTS_FOLDER_ID` (the root folder's ID from its Drive URL).
5. Trigger: `syncAssignments`, time-driven, hourly.
Files are made link-viewable automatically so parents can open them.
Individual (per-student) assignments are entered in the portal instead.

## 6. Teacher Workspace accounts

Teachers log in at /platform/ like everyone else and land in the Teacher
Workspace (Qur'an/academic entry + assignments for their grades only).
To create one:
1. Supabase Dashboard -> Authentication -> Add user (email + temp password).
2. SQL Editor:
   update public.profiles set role = 'teacher', full_name = 'Teacher Name',
     must_change_password = true,
     teacher_id = (select id from public.teachers where email = 'TEACHER_EMAIL')
   where id = (select id from auth.users where email = 'LOGIN_EMAIL');
   (Make sure the teacher record exists in Admin -> Teachers with grades assigned.)

## 7. Dev vs production

- Dev: project `falah-platform-dev` — test accounts, fake data. Dev repo's
  `platform-src/src/lib/supabase.ts` points here.
- Production (at launch): create a second free project `falah-platform-prod`,
  run the same three SQL files (skip the dev seed), real accounts, and point
  the master repo's config at it. Repeat keep-alive + backup setup for prod.
