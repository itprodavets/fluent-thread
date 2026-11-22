# Unified Profile Progress Implementation Plan

Execution: superpowers:executing-plans in the existing checkout, on a feature branch. Tracking uses the execution ledger rather than Markdown TODOs, as requested by repository instructions. No Beads database is installed in this repository.

Goal: a read-only, profile-scoped overview of vocabulary, phrases, dialogues, exercises, texts and corrected mistakes.
Architecture: derive counts and filtered rows from the current Study; retain existing result identifiers, schedules, cloud records and daily activity. No new analytics store, migration or historical backfill.
Tech Stack: existing TypeScript, React and Node test runner.
Spec: docs/superpowers/specs/2026-11-21-unified-profile-progress-design.md

## Constraints and review focus

Preserve all answers and review schedules. A due independent item remains independent. A choice-only success is not productive mastery. Phrases are a vocabulary subset, not extra words. Unattempted mistake cards are not fixed; stale successful answers after a newly saved mistake at level zero are not fixed. Archived and foreign-language material must not leak into counts. Completed own dialogues are completed practice, not learned model dialogues. Large dictionaries need bounded rendered lists and linear aggregation. Read only the current profile, including local guest profiles.

## Task 1 — Derived progress domain

Create src/domain/unified-progress.ts, with unifiedProgress(study, now, knownPhrases?) returning category summaries and rows. Each row has stable id, title, status, due flag, last outcome and mode, and an action target. Use existing teacherPhraseCards / phraseWordKey; accept skill phrases as inputs. Classify saved transcript phrases by source metadata. Include owned resources, plus assessed starter resources. Add separate own completed practice counts from sessions/resources, and error rows with before/after/reason/last answer. No mutation or new writes.

Create tests/unified-progress.test.ts first. Observe failure before implementation. Assert category counts and list equality, due overlap, independent versus assisted/choice, regression after success, untouched originals, snapshots/sync, profile/language separation, archived resources, own practice and a large dictionary. Run targeted tests, then commit this domain task.

## Task 2 — Progress screen

Create src/components/UnifiedProgress.tsx. Show current identity and storage status, six category summaries, clear definitions, and category/status filters with 30-row paging. Error rows expose before/after/explanation/answer without editing. Existing useWorkspace actions open word/material practice; errors link to the existing mistake review. Completed own practices are a separate metric. Integrate before the existing daily chart in Progress.tsx; retain the chart and label it as attempts, not all-time mastery. Use existing styling and responsive grids. Reset selection/paging on profile or language changes. Never render another profile while identity is changing.

Verify all tests, production build, desktop and phone UI, local guest notice and authenticated profile; do not grade real learner cards for testing. Commit task, perform a fresh whole-branch review, fix important findings with tests, push a PR, merge after CI, verify main deploy and live page. User already authorized commit and publication.
