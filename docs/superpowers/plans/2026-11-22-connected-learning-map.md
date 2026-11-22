# Connected learning map implementation plan

For implementers: use superpowers:subagent-driven-development with focused task reviews, then a whole-branch review. User approved the spec and publication. Reuse this checkout on feat/connected-learning-map; no new worktree requested. No active Beads workspace exists in this repository; this document defines deliverables, not a separate task database.

Goal: automatic school/lesson/scene/skill links and exact practice navigation, retaining manual graph state and learning progress.
Architecture: pure derived graph plus a sparse manual overlay in existing per-language metadata; current React/SVG editing and validated material URLs.
Tech stack: existing React/TypeScript/Vite and node:test, no new packages or SQL.
Spec: ../specs/2026-11-22-connected-learning-map-design.md

## Task 1 — Domain graph and compatible storage
Files: new src/domain/learning-graph.ts (split overlay/merge helpers if helpful), optional type additions in model.ts, narrow overlay handling in profile-sync.ts, tests/learning-graph.test.ts and tests/learning-map-sync.test.ts.
Interface for UI: buildLearningGraph(study, datedLessons, skills) returns {nodes,edges,height}; nodes {id,type:'school'|'lesson'|'dialogue'|'skill',title,language,point:{x,y},topicId?,school?,skillId?,versions?:{id,level?}[]}; edges {id,from,to,automatic:boolean,manual:boolean,label?}. Export projectLearningGraph(graph, focusId?, page?, pageSize=12) or equivalent bounded read-only projection returning nodes/edges/counts. Export moveLearningNode(study,graph,id,point), connectLearningNodes(study,graph,from,to), disconnectLearningNodes(study,graph,edgeId), all immutable and preserving unrelated data.
Reuse per-topic dialogueChoices identity semantics; derive source-backed edges without ambiguous skill matching or foreign-language English skills. Keep legacy topic connections and positions authoritative. Other typed edits live in languages[language].learningMap as a flat keyed dictionary, understood by existing serialization. Narrow synchronization handling must merge first independent overlay edits and preserve explicit deletion tombstones without changing ordinary language metadata merge semantics.
Validation: source/level identity, duplicate/untagged/user-created topics, focus paging, manual/automatic ownership, missing targets, refresh and full results preservation. Test real pack/reconcile round trips, initial concurrent edits, independent entries, same-entry conflicts and delete-versus-edit.

## Task 2 — Exact practice routing
Files: new src/domain/material-route.ts, targeted Materials.tsx integration, tests/material-route.test.ts. Do not edit map/domain graph files.
Interface: materialLessonHref(topicId, resourceId?, skillId?) creates a backwards-compatible lesson hash with encoded query; parseMaterialRoute(hash) reads it; resolveMaterialRoute(study, route, skills, datedLessons) or equivalent validates same-topic/current-language resource/skill. Preserve legacy topic URLs. Resource determines level, stale exact targets fall back within the requested topic with a visible explanation; never silently switch topics or add learning assessments. Materials uses the route selection on mount/hash change (Screen is keyed by hash).
Validation: exact B1/B2/C1 resource, repeated scene titles in different topics, malformed encoding, stale resource, foreign-language/cross-topic IDs, optional skill context, old URLs, unchanged study results/reviews.

## Task 3 — Typed graph UI and selection
Depends on Task 1 graph contract and Task 2 href helper. Files: Map.tsx, TopicCanvas.tsx (generalize or extract typed canvas), scoped graph CSS and focused UI helpers/tests. Retain topic editor and ordinary user topics.
Render four labelled node types, automatic/manual edge distinction, focused neighbourhood, school/skill browsing with bounded pagination, global search and an all-node destination picker. Group levels inside scene detail and link to an exact resource through materialLessonHref. School/skill selection reveals related lessons/scenes rather than inventing content. Retain drag, keyboard, handle/two-tap connect, zoom/reset and save feedback. Preserve saved global positions, using presentation-only fit/scroll for a readable desktop/mobile focus. Explain automatic lines and restrict remove actions to manual state.
Validation: full tests/build; browser desktop/narrow layout, automatic links, exact C1 practice, adding/removing manual links, editing/movement/reload and no progress changes. Check hidden search matches remain reachable and long names readable in the detail panel.

## Integration and delivery
Review each task against spec and quality; resolve findings before proceeding. Review the complete branch and run the full suite/build/diff check. Commit scoped changes, push PR, merge after CI and verify main Pages deployment. Use live browser checks and save screenshot proof. Do not touch unrelated .DS_Store, original recordings, auth settings or learner assessments.
