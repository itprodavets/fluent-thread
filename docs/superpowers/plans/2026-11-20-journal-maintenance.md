# Journal Maintenance Implementation Plan

Use executing-plans for inline implementation; one final independent review. User instructions override skill checklist tracking: steps here describe implementation and are not task checkboxes. No Beads database is present in this checkout.

**Goal:** Automatically remove heavy journal copies without expiring retry safety.
**Architecture:** Backward-compatible compact receipts in the existing sync RPC; bounded owner-only maintenance and dedicated pg_cron SQL.
**Tech stack:** PostgreSQL, pg_cron, PGlite, Node test runner.
**Spec:** `docs/superpowers/specs/2026-11-20-journal-maintenance-design.md`.

## Constraints and review focus

Keep mutation IDs/fingerprints and applied revisions forever. Do not modify dictionary/progress/tombstones. Preserve the client API and RLS. Retry after newer updates must not double-count progress. Legacy duplicate-ID requests must stay replayable. Maintenance must be bounded and inaccessible to clients. Cron history cleanup must affect only the two dedicated maintenance jobs.

## Task 1: Compact receipts and retry compatibility

1. Add `tests/profile-journal.test.ts`, using original SQL plus the new migration; test actual migrated SQL behavior and lost acknowledgments through ProfileStore. Run against missing/empty migration to observe failure.
2. Add `supabase/migrations/202611200001_compact_journal.sql`: immutable compaction helper, internal replay helper, replacement RPC with the unchanged signature, indexed bounded maintenance. Keep original migration immutable.
3. Run targeted tests, full suite and build; compare JSON response size for a realistic large batch. Commit the implementation after final review.

## Task 2: Automatic maintenance and operations

1. Add idempotent `supabase/maintenance/schedule_journal.sql`: enable pg_cron, named daily compaction/log retention job, separate nonexclusive VACUUM job. Keep scheduling separate from portable migration.
2. Update `supabase/README.md` with installation order, exact schedules, retention guarantees, pause/resume and read-only size/job checks.
3. Independent review of SQL/retry safety; fix significant findings with a failing regression and green suite. Merge, verify main CI. Prepare exact production SQL and request required browser action-time consent only after the changes are reviewable. Apply after approval, verify job execution and unchanged profile records.
