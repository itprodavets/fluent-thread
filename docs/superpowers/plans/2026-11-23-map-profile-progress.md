# Map profile progress implementation plan

> Execution: superpowers:executing-plans, inline implementation and one independent final review. Steps are numbered; repository instructions prohibit Markdown task checklists.

**Goal:** Display profile-scoped learning evidence and due practice directly on the connected map.

**Architecture:** Read existing Study results through the unified productive-assessment classifier and existing material repetition schedule. Derive summaries without persisting counters. Pass the same summary index to the canvas and details; exact dialogue URLs preserve levels, existing resource practice opens other material kinds in spoken mode.

**Tech stack:** Existing React, TypeScript, node:test, Vite; no dependencies or migrations.

**Spec:** ../specs/2026-11-23-map-profile-progress-design.md

## Constraints and review focus

Keep all profile state, manual graph edits and review dates unchanged on navigation. Different levels, profiles and languages never share evidence. Choice-only success is not independent mastery. Due flags use the same spoken schedule as the existing material queue; future written/choice schedules cannot hide an overdue spoken review. Deleted resources are excluded and partial lessons never imply full mastery. Refresh time every minute and on focus/visibility, with cleanup.

## Task 1: Read-only map projection

1. Create tests/learning-map-progress.test.ts: level separation, partial lesson, due independent result, retry/assisted, choice-only evidence, spoken versus written due, two profiles/languages, deleted resources, no mutation and recalculation after grading. Run and observe missing-module failure.
2. Export the existing productive classifier from src/domain/unified-progress.ts; keep its behavior unchanged. Create src/domain/learning-map-progress.ts with learningMapProgress(study, graph, now), status labels and summary text. Index resources by topic once; scene versions remain exact resource IDs.
3. Run focused projection/unified progress tests and TypeScript; commit only owned changes.

## Task 2: Canvas, detail and exact practice

1. Add src/components/LearningMapProgress.tsx for shared badge, selected-node summaries, per-level status links and due-material actions; consume current workspace and existing practice/material routes.
2. Modify Map.tsx and LearningCanvas.tsx to compute one summary index per current Study/time, show current profile, badges in graph/search/mobile browse, detail statuses and bounded due list. Keep graph context and manual edit handlers intact. Add scoped CSS with compact, textual, wrapping badges.
3. Run full tests, build and diff check. Verify desktop/mobile UI and exact due-level destination with disposable guest data, not real user assessments. Independent whole-branch review, address material findings, commit, merge and verify authoritative main build/deploy and live map.

## Execution evidence

Projection tests first failed on the absent module, then passed. The independent final review found a collision fallback returning an already occupied point. A seven-node regression reproduced the overlap before the fix; collision-free fallback packing and canvas capacity checks now pass for up to 100 nodes without changing stored positions. Final local suite: 182/182; production build and diff check pass.

Browser verification used existing disposable guest data and a temporary, isolated in-memory fixture (removed after testing). Confirmed B2 assessment appears on map while C1 remains new; due B2 opens that exact dialogue, due exercise opens the exact exercise in spoken mode; profile B has zero inherited results; mobile cards and per-level links show readable statuses. No real user's assessments were changed.
