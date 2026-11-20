# Local-first accounts and material repetition

## Purpose and chosen approach
New users keep their vocabulary, Anki imports, answers and progress on their own device. Connecting their own Supabase remains optional. Denis and Kseniia retain the existing shared-cloud sync between devices. Public lesson packages stay in the GitHub Pages bundle. No existing profile data is removed.

Alternatives considered: synchronizing everybody to the shared database is convenient but grows owner storage; automatically provisioning personal projects adds account authorization and infrastructure. The user chose local storage with optional personal Supabase for other users.

## Account storage
The shared project has an administrator-controlled allowlist for full sync. Its current existing profiles are preserved as members when shared mode is explicitly activated. An authenticated policy RPC tells the application whether study sync is allowed; the server also enforces it for writes and reads, including old clients. New signed-in users use a per-account local profile, with explicit local-only messaging and backup export. Own databases keep full sync; unavailable policy checks must not silently enable shared sync.

For statistics, count registered users in Supabase Auth, and use its existing last-sign-in information. Do not introduce third-party analytics or collect vocabulary, answers, per-card progress or Anki data for statistics. No public user directory. An ordinary sign-in is sufficient to appear in registered-user counts. No new telemetry endpoint is needed.

## Repetition
Use the existing PracticeResult scheduling and queue. Add a visible status and assessment control to dialogues, reading texts and exercises in the lesson and library. Outcomes: again (10 minutes), with a hint (1 day), independently recalled (existing increasing intervals of 1/3/7/14/30 days). Show the next date and distinguish a new item, learning and independent recall without claiming permanent mastery. Levels of one dialogue have separate resource IDs and therefore separate progress.

Extend “Repeat today” with due materials alongside existing word/phrase cards. A resource card provides a recall task before revealing its full text and translation, then saves the same assessment as the material view. Existing phrase controls and progress remain valid. Deleted/archived materials are not queued; language isolation remains intact. Ratings are explicit, never inferred from opening a page.

## Import and preservation
The new nature-and-nurture lesson is imported through the production UI into Denis's signed-in profile. Verify cloud synchronization and retained topic contents. Teacher recordings stay out of the published application. Do not mark any learning item as learned during verification of Denis's real profile.

## Delivery
Commit changes, run the full test suite and production build, publish through the existing GitHub workflow, and verify the deployed UI at desktop and phone viewport sizes. Add database migration and shared-mode activation SQL, with access control tests. Activation preserves all existing accounts' study records and must be verified in the live shared database.

## Builder check decisions
Apply policy checks to every project URL, including custom settings pointing back at the shared project. Only a definite missing-RPC response permits legacy own-project compatibility. Keep owner URL/user namespace, base revisions, outbox and conflicts during policy failures; pause sync and retry instead of falling into guest storage. Enforce policy inside the SECURITY DEFINER RPC before journal access, plus read RLS. Shared-mode activation is atomic and preserves existing profiles. Material ratings use the spoken schedule through one 10-minute retry adapter.

Approved by the user in chat on 2026-11-20.
