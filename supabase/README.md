# Supabase setup for GitHub Pages

The browser uses Supabase Auth plus owner-scoped PostgreSQL records. Only public URL/publishable key are passed to the Pages build. Never add service_role, secret keys, SMTP passwords or database passwords to the repository or browser environment.

1. Create a free project named `fluent-thread` in Singapore (or choose an existing dedicated project). The owner sets and keeps the database password.
2. Apply `migrations/202611190001_profiles.sql` using Supabase migrations or the SQL editor. It creates three tables with RLS and the `sync_study(changes, mutation, owner_id)` RPC. Only authenticated users can read their own records. Direct study writes and access to the idempotency journal are not granted to browsers.
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

The legacy guest vocabulary is preserved. Each signed-in owner gets an independent IndexedDB document. Durable outboxes retry a batch with the same mutation UUID. The RPC keeps a private idempotency journal, so a lost network acknowledgment does not double-count repetitions. The per-owner revision lock serializes writes, and tombstones propagate deletions.

Concurrent edits are merged field-by-field; same-field alternatives are retained locally in the profile conflict panel and backup. The cloud value is used until an explicit choice. Initial large imports run in batches (200 records / approximately 6 MB maximum); oversized individual records stop sync with a visible message. Large vocabulary order lists are omitted; vocabulary content and progress are retained.

Without public configuration the app remains usable locally and accurately states that cloud sync is not configured. Provisioning and real email/device checks remain separate from successful local tests.

## Optional: connect a personal Supabase backend

Open Profile → Своя база Supabase. Supply a project URL (HTTPS origin only) and a public publishable/anon key. Apply the migration and configure Auth/email delivery in that project first. The app checks the public `fluent_thread_schema_version()` RPC before saving the override. This RPC reveals only a version number; all study data remains protected by RLS.

The override stays in this browser. Enter the same configuration on your other device to sync with that database. Restore the app default using the reset button. Project switching retains each project's per-user local cache, outbox and recording/history namespaces; it does not automatically copy vocabulary into another project. Auth storage and caches include the project origin, so even identical UUIDs in different projects cannot share data. Database passwords, secret keys and service_role keys must never be entered into this setting.
