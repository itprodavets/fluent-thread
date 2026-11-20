# Storage policy and material repetition implementation plan

Goal: local-first new accounts, preserve family sync, visible spaced repetition for resources.
Architecture: admin-controlled server storage policy; existing profile namespace and results schedules; no telemetry service.
Tech stack: React, TypeScript, Supabase PostgreSQL, Node test runner, PGlite.
Spec: ../specs/2026-11-20-storage-and-material-review-design.md
Execution: inline in the existing clean checkout; no parallel product edits. User rules prohibit Markdown TODO tracking.

## Constraints and review focus
Preserve all existing study data, revisions and retries; fail closed on unavailable policy. Custom URL must not bypass shared policy. New resources and unassessed words must not silently become learned. Language/level boundaries remain separate. Never use real learner ratings for testing.

## 1. Cloud policy
Add migration with private shared-mode singleton and members table; authenticated storage-mode RPC. Default own projects allow full sync; explicit shared activation adds existing profiles before enabling restrictions. Enforce RLS and sync_study wrapper against direct/old-client uploads. Keep original RPC idempotence code in a private renamed implementation, revoked from browser roles.
Add storage-policy domain decoder and tests for cloud/local/missing-RPC/network error. Profiles resolves policy while keeping owner and persisted data, retries failed checks on focus/online, supplies no transport in local mode. Profile displays local-only vs shared/custom cloud and registration-only statistics explanation.
Validate real PostgreSQL grants and RLS with PGlite, both old and new clients, anonymous and authenticated roles. Commit this deliverable with schema and setup documentation.

## 2. Material repetition
Add generic resource review scheduling using existing assess and a 10-minute retry adapter; preserve schedules for other modes. Queue due resources with words, retain existing queue compatibility. Add reusable status/rating controls after reading/dialogue/exercise content and in library; levels use resource IDs.
Extend today's review with resource recall cards and full answer reveal, preserving word cards. Show status in reading results and library. Test future/due/new, language isolation, deleted materials and retry boundary. Commit this deliverable.

## 3. Delivery
Run npm test, npm run build, diff check. Review changes, fix issues. Push branch and merge PR after CI. Apply tested live migration and shared activation preserving current profiles (no data deletion). Confirm existing Denis lesson has 77 linked words and 59 resources, keep it selected. Verify production Pages workflow and UI at desktop/mobile viewport, profile synced and material ratings visible without submitting a real learner rating.
