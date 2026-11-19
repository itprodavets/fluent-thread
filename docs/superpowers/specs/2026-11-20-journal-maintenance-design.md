# Safe synchronization journal maintenance

The user requests automatic journal cleanup without losing vocabulary, progress or synchronization safety, with committed source. Implementation choices are delegated to the agent.

## Approaches

Deleting receipts after a fixed TTL would lose protection for arbitrarily old durable outboxes. Client acknowledgments would require a protocol rollout and still leave older clients. Compact receipts preserve compatibility and are the selected approach: remove copied values, retain mutation UUID, request fingerprint, applied record hashes/revisions, and conflicting record hashes.

## Design

The authenticated sync RPC still returns full applied/conflict rows. For a retry, verify the original request fingerprint, reconstruct applied values from that same request, and read current conflicting rows under the existing per-owner revision lock. Original applied revisions prevent double counting even after another device changes the record. Never expire receipts, tombstones, study records or profile revisions. Legacy batches containing duplicate IDs retain full responses because their original request ordering cannot safely be reconstructed.

New writes store compact receipts immediately. An owner-only maintenance function compacts up to 1,000 legacy responses per call using row locks with SKIP LOCKED and an index for unfinished rows. It cannot be called by anonymous/authenticated clients. A daily pg_cron job invokes maintenance at 20:00 UTC (04:00 Singapore), and removes only its own completed cron run logs older than seven days. A separate standard VACUUM at 20:10 UTC makes old journal storage reusable, without VACUUM FULL's exclusive table lock.

Only the journal is compacted; dictionary/progress rows are never removed. Small receipts still grow with activity, so cleanup reduces growth rather than guaranteeing the Free quota forever. PostgreSQL may keep allocated space for reuse after compaction. Do not upgrade billing, expose administrative credentials or upload audio.

## Validation

Exercise the real SQL migration in PGlite: legacy conversion, retry after another device changes words/counters/deletions, current conflicts, duplicate IDs, changed-payload rejection, owner isolation, forbidden maintenance access, bounded/idempotent cleanup, and meaningful payload reduction. Exercise a lost HTTP acknowledgment through the actual ProfileStore and migrated SQL RPC. Run all tests/build, review, commit/merge, then verify the live job configuration and a maintenance run. Production cleanup requires an action-time confirmation if applied through the browser UI.
