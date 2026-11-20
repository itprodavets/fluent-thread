# New Vibe lesson and neutral learner roles

User scope: add the latest completed Vibe lesson in full and replace the learner's personal name in educational materials with a clear role. Existing instructions retain text-only teacher material, level variants, vocabulary, grammar and committed delivery.

Implementation runs inline under executing-plans, with a final independent review. Reuse this clean checkout on a feature branch. There is no Beads database here; this document describes work and does not track tasks.

1. Transcribe the 47:53 recording dated 20 November 11:20 locally with Vibe. Read every segment, retain full chronological coverage, mark recognition gaps and uncertain speaker attribution. Raw audio and private source remain local. Publish a text lesson with English, Russian support, adapted level variants, vocabulary, teacher expressions, corrections where attribution is supported, and grammar exercises.
2. Replace the learner name in checked-in educational text with Learner / Ученик. For existing imported resources, migrate only text fields, preserving resource/word/topic IDs, answers' meaning, profile names, review history and user-authored vocabulary. Update managed-import snapshots only if their previous content matched the original resource. Normalize cloud-arriving resource text too, so an older device cannot restore the display name.
3. Add the package to the bundled lesson catalog, validate package limits, all six levels and complete transcript coverage. Test role migration idempotence, synchronization and unchanged IDs/progress. Review, commit, merge and check main deployment. Verify the new lesson in the real app, including the existing signed-in learner profile.

Design choice: edit canonical text and migrate stored lesson resources instead of a visual-only replacement, so reading, speech synthesis, export and practice use the same roles. Do not rename the real signed-in profiles. Source attribution is not inferred from a mistaken automatic speaker label.

User steering: reorganize all materials by language → school → topic, not top-level dates. Retain dates as metadata, combine the old indexes into an English catalog, move resource/skill/school catalogs under en, update every active import and relative link, and preserve stored IDs/recording keys. Validate the full catalog, package coverage and Markdown links before delivery.
