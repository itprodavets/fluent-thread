# Interactive learning map implementation plan

Goal: implement the approved map design while preserving existing profile data.
Spec: ../specs/2026-11-22-interactive-learning-map-design.md (user approved 22 November).
Architecture: React TopicCanvas plus pure graph helpers, persisted through existing Topic.position/connections and useWorkspace.update. No new cloud fields or dependencies.

## Deliverable
Update Map.tsx, TopicCanvas.tsx, scoped graph CSS and a small domain helper as needed. Show the map first, create/edit/select topics, connect by handle-drag or two clicks, search, zoom/reset, selected-topic learning actions, keyboard movement and touch-friendly controls. Keep route examples secondary. Reuse existing topic editor and never reset words, resources, results or repetition dates. Reuse current checkout on a feature branch; no new worktree requested. No active Beads workspace exists in this repository.

## Validation
Test graph editing against existing and mixed-language topics, duplicate/self connections, hidden connected nodes, coordinate boundaries, and immutable preservation of unrelated study data. Run full tests and build. Check desktop and narrow UI in browser, including move, connect, create, reload persistence and access to materials. Commit reviewed implementation, merge via PR and verify main Pages deployment plus live map.
