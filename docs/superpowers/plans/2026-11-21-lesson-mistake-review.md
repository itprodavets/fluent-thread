# Lesson mistakes in daily review

Goal: let the learner revisit the documented issues from both November 20 evening classes, answer freely and assess whether the issue was corrected, in the existing “Повторить сегодня” queue.

The user explicitly requested adding these issues to their queue; the existing approved material-review and profile-sync design remains in force. Reuse the dialogueMistakes map and its record-level cloud sync. Do not automatically assign public lesson examples as anyone’s personal mistakes.

Approach: 29 curated examples (12 DC, 17 provisionally ACE) are offered through an explicit add action only when the corresponding recording is already in the current profile. Stable recording/card IDs make addition idempotent and preserve existing due dates, answers and mastery. Uncertain lexical ASR, other speakers and successful fragments are excluded. Contextual and naturalness tasks state their scope rather than pretending every source fragment is a grammatical error.

For open paraphrases, show a model and a small checklist after the learner writes or records a response. Self-assessment is explicit: retry after ten minutes, assisted after one day, independent after 1/3/7/14/30 days. This avoids an exact-string checker rejecting valid paraphrases or claiming to understand unrestricted English. Existing rule-based feedback for older cards is unchanged.

Implementation order: add and test the curated-data/seed/assessment domain; merge scheduled dialogue mistakes into the daily queue; add explicit import and written/spoken comparison controls; retain completed-card feedback until Next; verify existing profile sync round-trips new optional fields. Then run full tests/build, review the branch, publish and use the add action in the owner’s profile. Do not answer or score real personal cards during verification.

Files: per-lesson mistake-practice.json; domain/lesson-mistakes.ts; domain/dialogue-mistakes.ts; domain/lesson-review.ts; components/LessonMistakeReply.tsx, SkillReply.tsx, DialogueMistakeReview.tsx, LessonReview.tsx. No dependencies, auth changes or database migrations.

Verification: empty/other-language profiles get no offered cards; initial cards are due immediately with no invented practice results; repeat imports and cloud round-trips preserve personal progress; future mistakes influence the next timer; words/materials/mistakes remain distinct in the queue; free answers persist with explicit self-assessment; feedback remains visible before advancing. Public fixtures contain neutral roles, source timestamps, no original audio or personal contacts.
