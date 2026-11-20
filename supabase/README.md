# Supabase setup for GitHub Pages

The browser uses Supabase Auth plus owner-scoped PostgreSQL records. Only public URL/publishable key are passed to the Pages build. Never add service_role, secret keys, SMTP passwords or database passwords to the repository or browser environment.

1. Create a free project named `fluent-thread` in Singapore (or choose an existing dedicated project). The owner sets and keeps the database password.
2. Apply all files in `migrations/` in filename order using Supabase migrations or the SQL editor. The initial migration creates three tables with RLS and the `sync_study(changes, mutation, owner_id)` RPC; the next migration adds compact retry receipts and owner-only maintenance. Only authenticated users can read their own records. Direct study writes and access to the idempotency journal are not granted to browsers.
3. In Auth / URL Configuration set Site URL and allowed redirect URL to `https://itprodavets.github.io/fluent-thread/` (also allow `https://itprodavets.github.io/fluent-thread/#profile` for the current login redirect). Add localhost only to a development project as needed.
4. Enable email sign-in. Configure custom SMTP and a verified sender. Supabase default email delivery only supports project team addresses and has very low rate limits; do not call the login production-ready until email delivery works for both intended users. For code entry use the email template `{{ .Token }}`; the app also accepts the default magic-link flow through the Supabase client.
5. Add repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. These are public browser configuration. Re-run Pages build after changing them. For local development copy `.env.example` to `.env.local` and supply the public values.
6. Each owner opens `#profile`, enters their own email and verifies the email. Auth creates separate identities; accounts are not fabricated or marked verified by an administrator. Enter a display name. Existing browser data can be explicitly added under “Перенести словарь, который был без входа”. Do this only in the intended profile.
7. Verify on two devices: create a word/review on device one, sync, sign into the same email on device two, check both. Then sign into a second email and confirm isolation. Check an offline edit and retry. Use “Скачать резервную копию” before large imports.

## Default hosted deployment

The Fluent Thread deployment uses project **fluent-thread** in Singapore (`ap-southeast-1`):

- Public API origin: `https://wizjjgydhqbjcdkomqji.supabase.co`
- [Project dashboard](https://supabase.com/dashboard/project/wizjjgydhqbjcdkomqji)
- Site URL: `https://itprodavets.github.io/fluent-thread/`
- Browser configuration is supplied by the GitHub Actions variables listed above; no administrative keys or database passwords are part of the repository.

The checked-in initial schema has been applied to this project. Its public version endpoint returns `1`; unauthenticated reads of `study_records` are denied. Email ownership must be confirmed before a learner can use the authenticated profile. First-time users explicitly add their legacy browser vocabulary to their own signed-in profile. Configuring this deployment does not verify an email address on the learner's behalf.

## Data and limitations

Words, topics, resources, practice results, errors and learning drafts are synchronized. Local audio and detailed imported Anki review events are deliberately not uploaded. Their local databases are namespaced per owner. Profile backups contain Study data and conflict alternatives, not authentication tokens or audio/Anki event databases.

The legacy guest vocabulary is preserved. Each signed-in owner gets an independent IndexedDB document. Durable outboxes retry a batch with the same mutation UUID. The RPC keeps a private idempotency journal, so a lost network acknowledgment does not double-count repetitions. Compact receipts retain the request fingerprint and applied revisions indefinitely, without copied vocabulary/progress values. On retry, applied values are reconstructed from the fingerprint-verified original request; conflicts are refreshed from current owner records. Historical batches with duplicate IDs retain their full response to avoid ambiguous reconstruction. The per-owner revision lock serializes writes, and tombstones propagate deletions.

## Automatic journal maintenance

After applying all migrations, run `maintenance/schedule_journal.sql` as the database owner. This enables the official [Supabase Cron module](https://supabase.com/docs/guides/cron/quickstart) and installs two named jobs (rerunning updates the same jobs):

| Job | UTC | Singapore | Action |
| --- | --- | --- | --- |
| `fluent-thread-journal-maintenance` | Daily 20:00 | Daily 04:00 | Compact up to 1,000 legacy responses; delete only these two jobs' completed run logs older than seven days |
| `fluent-thread-journal-vacuum` | Daily 20:10 | Daily 04:10 | Standard `VACUUM (ANALYZE)` on the journal |

New sync requests already save compact receipts, so daily processing is a bounded fallback for legacy rows. Maintenance cannot be called by anonymous/authenticated browser users. It never deletes study records, profiles, revisions, tombstones or mutation receipts. Do not add TTL deletion of receipts: an arbitrarily old device outbox still needs its original acknowledgment to prevent duplicate counters. Do not restore the old RPC migration over a compacted journal; its retry code cannot interpret compact receipts.

Compact receipts still grow with activity. This reduces growth; it does not guarantee that all future data will fit the Free quota. Common lesson assets stay in GitHub Pages; audio is not uploaded. Space from removed journal values becomes reusable after normal VACUUM; allocated database size may not immediately fall. Do not use `VACUUM FULL` during normal use because it takes an exclusive table lock.

Optional initial catch-up (after approval to discard redundant journal copies): `select public.compact_study_mutations(1000);`. Repeat only while the returned count is 1,000. Run `vacuum (analyze) public.study_mutations;` as a separate statement outside a transaction.

Read-only operational checks:

```sql
select pg_size_pretty(pg_database_size(current_database())) as database_size,
       pg_size_pretty(pg_total_relation_size('public.study_mutations')) as journal_size;
select count(*) filter (where not (response ? 'compact')) as pending_legacy,
       count(*) filter (where response->>'compact' = 'true') as compact_receipts,
       count(*) filter (where response->>'compact' = 'false') as retained_duplicate_batches
from public.study_mutations;
select jobid, jobname, schedule, active from cron.job
where jobname in ('fluent-thread-journal-maintenance', 'fluent-thread-journal-vacuum');
select jobid, status, return_message, start_time, end_time from cron.job_run_details
where jobid in (select jobid from cron.job where jobname in (
  'fluent-thread-journal-maintenance', 'fluent-thread-journal-vacuum'
)) order by start_time desc limit 10;
```

To pause cleanup without reverting retry support, use `select cron.alter_job(jobid, active := false) from cron.job where jobname in ('fluent-thread-journal-maintenance', 'fluent-thread-journal-vacuum');`; use `true` to resume. Cron does not run while a Free project is paused. Check quota usage in the Supabase dashboard periodically; this feature creates no billing upgrade or external monitoring service.

Concurrent edits are merged field-by-field; same-field alternatives are retained locally in the profile conflict panel and backup. The cloud value is used until an explicit choice. Initial large imports run in batches (200 records / approximately 6 MB maximum); oversized individual records stop sync with a visible message. Large vocabulary order lists are omitted; vocabulary content and progress are retained.

Without public configuration the app remains usable locally and accurately states that cloud sync is not configured. Provisioning and real email/device checks remain separate from successful local tests.

## Optional: connect a personal Supabase backend

Open Profile → Своя база Supabase. Supply a project URL (HTTPS origin only) and a public publishable/anon key. Apply the migration and configure Auth/email delivery in that project first. The app checks the public `fluent_thread_schema_version()` RPC before saving the override. This RPC reveals only a version number; all study data remains protected by RLS.

The override stays in this browser. Enter the same configuration on your other device to sync with that database. Restore the app default using the reset button. Project switching retains each project's per-user local cache, outbox and recording/history namespaces; it does not automatically copy vocabulary into another project. Auth storage and caches include the project origin, so even identical UUIDs in different projects cannot share data. Database passwords, secret keys and service_role keys must never be entered into this setting.

## Local-first shared project

Apply `migrations/202611200002_storage_policy.sql` after the journal migration. Own installations keep full sync by default. On the application owner's shared project only, run `maintenance/enable-shared-local-default.sql` once: it atomically preserves every existing `study_profiles` account in a private allowlist and makes later accounts local-only. The activation does not delete or rewrite learning rows. Re-running activation never adds later users to the list.

Both read RLS and the SECURITY DEFINER sync wrapper enforce storage mode; browser roles cannot call the internal implementation or edit membership/settings. Using the shared URL under “own database” does not bypass this policy. A failed policy check pauses sync but preserves the same local profile, outbox and revisions. A definitively absent RPC is accepted only for a different legacy personal project.

Statistics require no study-data uploads: the administrator can count registrations and inspect existing last-sign-in values in Supabase Authentication. No public directory or additional analytics collector is created.

Read-only checks:
```sql
select shared_mode from public.study_storage_settings;
select count(*) as retained_cloud_accounts from public.study_cloud_members;
select count(*) as registered_accounts, count(*) filter (where last_sign_in_at >= now()-interval '30 days') as signed_in_last_30_days from auth.users;
```

## Email and password sign-in

The profile offers `signInWithPassword` as its primary login flow. Existing confirmed email identities set their first password through the signed-in profile using `updateUser({ password })`; their user ID and study data remain unchanged. Passwords never enter Study, sync records, backups, URLs or app analytics. New password entry requires 12 characters and a matching confirmation; existing password login has no artificial minimum that would exclude an older valid password.

The signed-in form accepts an existing password when a personal project requires `current_password`. Reauthentication errors are surfaced with instructions to sign in freshly; the application does not weaken server protections. Recovery uses `resetPasswordForEmail` and the existing `#profile` allowlisted redirect. The `PASSWORD_RECOVERY` auth event opens password settings. Registration/confirmation and password recovery still depend on email delivery. Password changes must be entered and submitted by the account owner.

Email-link login remains available. The shared Free project currently uses default link-only mail templates; changing them to include `{{ .Token }}` requires custom SMTP (or a supported paid email/template option). Do not present email OTP as operational merely because the input field exists.
