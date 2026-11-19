# Profiles and cross-device study sync

Denis approved Supabase email sign-in, independent profiles for Denis and Kseniia, a browser cache and cross-device vocabulary/progress sync. GitHub Pages continues hosting the app. Local-only profiles would not sync; a custom server would add unnecessary maintenance.

Each verified email owns a Supabase Auth UUID. RLS on profile and study tables enforces ownership, including through RPC. Browser code uses only a publishable key. No administrator key is bundled or committed. Auth email delivery requires production SMTP; default Supabase email cannot be assumed to support both users.

Study state is split into records by collection/key. Only changed records are uploaded in bounded batches. Server revisions and conditional writes prevent an offline device from overwriting newer data. Three-way reconciliation combines unrelated fields; simultaneous scalar changes choose the server value and preserve the local alternative in a visible conflict list. Deletions are tombstones, so offline devices cannot resurrect deleted entries. Concurrent practice counters combine deltas.

IndexedDB caches each owner separately. A logout/account change remounts the entire workspace and rejects late writes to the old workspace. Legacy guest data remains intact, and importing it is an explicit action in the signed-in profile. Local audio takes and detailed Anki history remain device-only and are isolated by profile; vocabulary and app repetition results sync. Profile export includes vocabulary, materials, progress and sync-conflict alternatives, but not local audio or detailed Anki history.

UI: account icon opens a Profile page showing verified email, editable display name, sync status, retry, guest-data import and backup. Email OTP login has separate send/verify steps; no pre-created shared password or fabricated email verification. First login creates an empty independent workspace. A profile appears only after its owner verifies the email.

Provision a Supabase project, apply the checked-in SQL, configure allowed redirect/site URLs and SMTP, add public URL/key as GitHub Actions variables, then deploy and verify two isolated users and cross-device changes. No paid plan is selected automatically. If provider access is missing, ship code/configuration with an explicit unconfigured state and report the remaining setup accurately.

## Review decisions

Use a per-owner Web Lock for one writer per browser profile; another tab waits and opens automatically after the first finishes pending persistence. Index record identity using a SHA-256 digest instead of the potentially long serialized word/translation ID; retain the full ID for round trips. Normalize missing counter trees during record reconciliation. These decisions were verified against the branch review findings.

## User-approved extension: own Supabase project

The Profile page can override the built-in project with an HTTPS Supabase URL and a publishable/anon key, or restore the default. A public RPC checks schema version without exposing user data before saving a connection. Administrative secrets are rejected. Invalid stored settings fail closed instead of silently redirecting data to another database. Auth sessions, IndexedDB caches, auxiliary local data and Web Locks are scoped by project origin plus verified Auth UUID. Switching project preserves old caches and durable outboxes, then reloads the app. Connection settings are device-local and must also be entered on another device using the custom backend. Each custom project requires its own schema and email delivery configuration.
